import { describe, expect, it } from 'vitest';
import { atmosphereDirection, defaultSceneAtmosphere, moodPresets, parseSceneAtmosphere, parseStudyTime, renameAtmosphereSnapshot, resolveAtmosphere, saveAtmosphereSnapshot, solarPosition, studyProblems, validStudyDate, type SunStudySettings } from '../src/sceneAtmosphere';

const study = (patch: Partial<SunStudySettings> = {}): SunStudySettings => ({ latitude: 40, longitude: 0, northDegrees: 0, date: '2026-06-21', minutesLocal: 720, utcOffsetMinutes: 0, daylightSaving: false, ...patch });
describe('geometric sunlight', () => {
  it('agrees within one degree with the independent NREL SPA worked example, without claiming SPA accuracy', () => {
    // NREL/TP-560-34302 (Jan 2008), Appendix A.5 / Table A5.1. Source uses refraction;
    // our deliberately simpler NOAA-series geometric result has a broader tolerance.
    const result = solarPosition(study({ latitude: 39.742476, longitude: -105.1786, date: '2003-10-17', minutesLocal: 750.5, utcOffsetMinutes: -420 }))!;
    expect(Math.abs(result.elevation - (90 - 50.11162))).toBeLessThan(1);
    expect(Math.abs(result.azimuth - 194.34024)).toBeLessThan(1);
    expect(result.utcISO).toBe('2003-10-17T19:30:30.000Z');
  });
  it.each([
    ['2026-06-21', 40, 73.45], ['2026-12-21', 40, 26.55],
    ['2026-12-21', -40, 73.45], ['2026-06-21', -40, 26.55],
  ])('matches solstice noon geometry on %s at latitude %s', (date, latitude, expected) => {
    const result = solarPosition(study({ date, latitude }))!;
    expect(Math.abs(result.elevation - expected)).toBeLessThan(.6);
    expect(result.aboveHorizon).toBe(true);
  });
  it('handles polar night, midnight sun and exact poles without NaN or invented direct light', () => {
    const winter = study({ latitude: 78, date: '2026-12-21' }), summer = study({ latitude: 78, minutesLocal: 0 });
    expect(solarPosition(winter)!.elevation).toBeLessThan(0);
    expect(solarPosition(summer)!.elevation).toBeGreaterThan(0);
    for (const latitude of [-90, 90]) for (const date of ['2026-06-21', '2026-12-21']) {
      const result = solarPosition(study({ latitude, date }))!; expect(Number.isFinite(result.azimuth)).toBe(true); expect(Number.isFinite(result.elevation)).toBe(true);
    }
    const value = defaultSceneAtmosphere(); value.mode = 'sun-study'; value.study = winter;
    expect(resolveAtmosphere(value)!.sunIntensity).toBe(0);
    expect(resolveAtmosphere(value)!.rain).toBe(0);
  });
  it('preserves the same instant across DST, half/quarter-hour zones and date rollover', () => {
    const expected = solarPosition(study({ date: '2026-06-21', minutesLocal: 30 }))!;
    for (const patch of [
      { minutesLocal: 90, daylightSaving: true },
      { minutesLocal: 360, utcOffsetMinutes: 330 },
      { minutesLocal: 375, utcOffsetMinutes: 345 },
      { date: '2026-06-20', minutesLocal: 1170, utcOffsetMinutes: -300 },
    ]) {
      const result = solarPosition(study(patch))!; expect(result.utcISO).toBe(expected.utcISO); expect(result.azimuth).toBeCloseTo(expected.azimuth, 10); expect(result.elevation).toBeCloseTo(expected.elevation, 10);
    }
    expect(solarPosition(study({ daylightSaving: true }))!.utcISO).not.toBe(solarPosition(study())!.utcISO);
  });
  it('requires confirmed orientation and explicit time settings and rejects impossible civil dates', () => {
    const missing = defaultSceneAtmosphere().study;
    expect(studyProblems(missing)).toHaveLength(4); expect(solarPosition(missing)).toBeUndefined();
    expect(validStudyDate('2024-02-29')).toBe(true); expect(validStudyDate('2025-02-29')).toBe(false); expect(validStudyDate('1900-02-29')).toBe(false);
    for (const patch of [{ date: '2026-13-01' }, { minutesLocal: 1440 }, { latitude: NaN }, { longitude: Infinity }, { utcOffsetMinutes: 840, daylightSaving: true }]) expect(solarPosition(study(patch))).toBeUndefined();
    expect(parseStudyTime('23:59')).toBe(1439); expect(parseStudyTime('24:00')).toBeUndefined(); expect(parseStudyTime('1:30')).toBeUndefined();
  });
  it('rotates geographic north into the existing plan coordinate convention', () => {
    const a = solarPosition(study())!, b = solarPosition(study({ northDegrees: 90 }))!;
    expect(b.elevation).toBe(a.elevation); expect(b.azimuth).toBe(a.azimuth); expect(b.worldAzimuth).toBeCloseTo((a.azimuth + 90) % 360);
    const east = atmosphereDirection(90, 0); expect(east.x).toBeCloseTo(-1); expect(east.z).toBeCloseTo(0);
    const north = atmosphereDirection(0, 0); expect(north.z).toBeCloseTo(1);
  });
});
describe('saved moods and lighting precedence', () => {
  it('does not override existing lighting until enabled and blocks incomplete studies', () => {
    expect(resolveAtmosphere(undefined)).toBeNull(); expect(resolveAtmosphere(defaultSceneAtmosphere())).toBeNull();
    const incomplete = defaultSceneAtmosphere(); incomplete.mode = 'sun-study'; expect(resolveAtmosphere(incomplete)).toBeNull();
    const value = defaultSceneAtmosphere(); value.mode = 'mood'; value.mood = structuredClone(moodPresets[2].settings);
    expect(resolveAtmosphere(value)!.sunIntensity).toBe(0); expect(resolveAtmosphere(value)!.lampIntensity).toBe(1.7);
  });
  it('round-trips named settings, copies snapshots independently, renames and bounds storage without persisting audio', () => {
    let value = defaultSceneAtmosphere('2026-06-21'); value.mode = 'mood';
    value.mood.fixtureOverrides = { 'lamp-1': { enabled: false, kelvin: 3000, brightness: 1.2 } };
    value = saveAtmosphereSnapshot(value, 'Reading', 'saved-1'); value.mood.fixtureOverrides['lamp-1'].enabled = true;
    expect(value.savedMoods[0].settings.fixtureOverrides['lamp-1'].enabled).toBe(false);
    value = renameAtmosphereSnapshot(value, 'savedMoods', 'saved-1', 'Evening'); expect(value.savedMoods[0].name).toBe('Evening');
    for (let i = 2; i <= 8; i++) value = saveAtmosphereSnapshot(value, `Mood ${i}`, `saved-${i}`);
    expect(() => saveAtmosphereSnapshot(value, 'Overflow', 'saved-9')).toThrow(/maximum/);
    const parsed = parseSceneAtmosphere({ ...JSON.parse(JSON.stringify(value)), soundEnabled: true }); expect(parsed).toEqual(value); expect(parsed).not.toHaveProperty('soundEnabled');
    expect(parseSceneAtmosphere({ ...value, mood: { ...value.mood, rain: 2 } })).toBeUndefined();
    expect(parseSceneAtmosphere({ ...value, savedMoods: [value.savedMoods[0], value.savedMoods[0]] })).toBeUndefined();
    expect(parseSceneAtmosphere(JSON.parse(JSON.stringify(value).replace('"lamp-1"', '"__proto__"')))).toBeUndefined();
  });
});
