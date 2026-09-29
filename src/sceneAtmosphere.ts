import type {PlanDocumentV1} from './types';
/** Approximate geometric sun: NOAA's published fractional-year equations.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * No atmospheric refraction, terrain horizon, illuminance, or energy model.
 */
export interface SunStudySettings {
  latitude: number | null;
  longitude: number | null;
  /** Geographic north clockwise from plan-up (-Z), confirmed by the user. */
  northDegrees: number | null;
  date: string;
  minutesLocal: number;
  /** Standard UTC offset; DST adds exactly 60 minutes. No browser timezone inference. */
  utcOffsetMinutes: number | null;
  daylightSaving: boolean;
}
export interface FixtureMood { enabled: boolean; kelvin: number; brightness: number }
export interface SceneMoodSettings {
  azimuth: number; elevation: number; cloudiness: number;
  lampKelvin: number; lampBrightness: number;
  rain: number; windSpeed: number; windDirection: number; animated: boolean;
  fixtureOverrides: Record<string, FixtureMood>;
}
export interface NamedSceneMood { id: string; name: string; settings: SceneMoodSettings }
export interface NamedSunStudy { id: string; name: string; settings: SunStudySettings }
export interface SceneAtmosphereV1 {
  version: 1;
  mode: 'off' | 'mood' | 'sun-study';
  mood: SceneMoodSettings; study: SunStudySettings;
  savedMoods: NamedSceneMood[]; comparisons: NamedSunStudy[];
}
export type RGB = { r: number; g: number; b: number };
export interface SolarPosition {
  azimuth: number; elevation: number; worldAzimuth: number; aboveHorizon: boolean;
  utcISO: string; equationOfTimeMinutes: number; declination: number;
}
export interface AtmosphereFrame {
  mode: 'mood' | 'sun-study';
  direction: { x: number; y: number; z: number };
  sunIntensity: number; sunColor: RGB; skyIntensity: number; skyColor: RGB;
  groundColor: RGB; lampColor: RGB; lampIntensity: number;
  fixtureOverrides: Record<string, FixtureMood>;
  rain: number; windSpeed: number; windDirection: number; animated: boolean;
  solar?: SolarPosition;
}
export const MAX_SAVED_ATMOSPHERES = 8;
export const MAX_FIXTURE_OVERRIDES = 64;
export const MAX_RAIN_DROPS = 96;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mod = (v: number, n: number) => ((v % n) + n) % n;
const rad = Math.PI / 180;
const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });
const baseMood: SceneMoodSettings = { azimuth: 100, elevation: 25, cloudiness: .15, lampKelvin: 2700, lampBrightness: 1, rain: 0, windSpeed: 0, windDirection: 90, animated: true, fixtureOverrides: {} };
export const moodPresets: readonly NamedSceneMood[] = [
  { id: 'morning', name: 'Morning light', settings: { ...baseMood } },
  { id: 'rainy', name: 'Rainy afternoon', settings: { ...baseMood, azimuth: 190, elevation: 38, cloudiness: .9, rain: .55, windSpeed: .3, lampBrightness: 1.25 } },
  { id: 'reading', name: 'Evening reading', settings: { ...baseMood, azimuth: 275, elevation: -8, cloudiness: .2, lampKelvin: 2300, lampBrightness: 1.7 } },
];
export function defaultSceneAtmosphere(date = new Date().toISOString().slice(0, 10)): SceneAtmosphereV1 {
  return { version: 1, mode: 'off', mood: structuredClone(baseMood), study: { latitude: null, longitude: null, northDegrees: null, date, minutesLocal: 12 * 60, utcOffsetMinutes: null, daylightSaving: false }, savedMoods: [], comparisons: [] };
}
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function num(v: unknown, min: number, max: number): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max; }
function optionalNum(v: unknown, min: number, max: number): v is number | null { return v === null || num(v, min, max); }
export function validStudyDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return y >= 1900 && y <= 2100 && new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v;
}
function parseStudy(v: unknown): SunStudySettings | undefined {
  if (!record(v) || !optionalNum(v.latitude, -90, 90) || !optionalNum(v.longitude, -180, 180) || !optionalNum(v.northDegrees, 0, 360) || !validStudyDate(v.date) || !num(v.minutesLocal, 0, 1439.999999) || !optionalNum(v.utcOffsetMinutes, -720, 840) || typeof v.daylightSaving !== 'boolean') return;
  if (v.utcOffsetMinutes !== null && (!Number.isInteger(v.utcOffsetMinutes) || !num(v.utcOffsetMinutes + (v.daylightSaving ? 60 : 0), -720, 840))) return;
  return { latitude: v.latitude, longitude: v.longitude, northDegrees: v.northDegrees, date: v.date, minutesLocal: v.minutesLocal, utcOffsetMinutes: v.utcOffsetMinutes, daylightSaving: v.daylightSaving };
}
function parseFixture(v: unknown): FixtureMood | undefined {
  if (!record(v) || typeof v.enabled !== 'boolean' || !num(v.kelvin, 1800, 6500) || !num(v.brightness, 0, 2.5)) return;
  return { enabled: v.enabled, kelvin: v.kelvin, brightness: v.brightness };
}
function parseMood(v: unknown): SceneMoodSettings | undefined {
  if (!record(v) || !num(v.azimuth, 0, 360) || !num(v.elevation, -30, 90) || !num(v.cloudiness, 0, 1) || !num(v.lampKelvin, 1800, 6500) || !num(v.lampBrightness, 0, 2.5) || !num(v.rain, 0, 1) || !num(v.windSpeed, 0, 1) || !num(v.windDirection, 0, 360) || typeof v.animated !== 'boolean' || !record(v.fixtureOverrides)) return;
  const entries = Object.entries(v.fixtureOverrides);
  if (entries.length > MAX_FIXTURE_OVERRIDES) return;
  const fixtureOverrides: Record<string, FixtureMood> = {};
  for (const [id, value] of entries) {
    const fixture = parseFixture(value);
    if (!validId(id) || !fixture) return;
    Object.defineProperty(fixtureOverrides, id, { value: fixture, enumerable: true, writable: true, configurable: true });
  }
  return { azimuth: v.azimuth, elevation: v.elevation, cloudiness: v.cloudiness, lampKelvin: v.lampKelvin, lampBrightness: v.lampBrightness, rain: v.rain, windSpeed: v.windSpeed, windDirection: v.windDirection, animated: v.animated, fixtureOverrides };
}
function validId(v: unknown): v is string { return typeof v === 'string' && v.length > 0 && v.length <= 160 && !['__proto__', 'constructor', 'prototype'].includes(v); }
function named<T>(value: unknown, parse: (v: unknown) => T | undefined): { id: string; name: string; settings: T }[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_SAVED_ATMOSPHERES) return;
  const found = new Set<string>(), result: { id: string; name: string; settings: T }[] = [];
  for (const item of value) {
    if (!record(item) || !validId(item.id) || found.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60) return;
    const settings = parse(item.settings); if (!settings) return;
    found.add(item.id); result.push({ id: item.id, name: item.name.trim(), settings });
  }
  return result;
}
/** Optional saved-data boundary: invalid input is rejected, never used by the renderer. */
export function parseSceneAtmosphere(value: unknown): SceneAtmosphereV1 | undefined {
  if (!record(value) || value.version !== 1 || !['off', 'mood', 'sun-study'].includes(String(value.mode))) return;
  const mood = parseMood(value.mood), study = parseStudy(value.study), savedMoods = named(value.savedMoods, parseMood), comparisons = named(value.comparisons, parseStudy);
  if (!mood || !study || !savedMoods || !comparisons) return;
  return { version: 1, mode: value.mode as SceneAtmosphereV1['mode'], mood, study, savedMoods, comparisons };
}
export function studyProblems(settings: SunStudySettings): string[] {
  const missing: string[] = [];
  if (settings.latitude === null) missing.push('Enter latitude.');
  if (settings.longitude === null) missing.push('Enter longitude.');
  if (settings.northDegrees === null) missing.push('Confirm north relative to the plan.');
  if (settings.utcOffsetMinutes === null) missing.push('Enter the standard UTC offset and confirm daylight saving.');
  if (!parseStudy(settings)) missing.push('Use a real date from 1900–2100, a time within this day, and a valid UTC offset.');
  return missing;
}
export function solarPosition(settings: SunStudySettings): SolarPosition | undefined {
  if (studyProblems(settings).length) return;
  const [y, m, d] = settings.date.split('-').map(Number);
  const epoch = Date.UTC(y, m - 1, d) + (settings.minutesLocal - settings.utcOffsetMinutes! - (settings.daylightSaving ? 60 : 0)) * 60000;
  const utc = new Date(epoch), year = utc.getUTCFullYear();
  const day = Math.floor((Date.UTC(year, utc.getUTCMonth(), utc.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const minutes = utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60 + utc.getUTCMilliseconds() / 60000;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  // Evaluate orbital terms at the same UTC instant regardless of its civil-time representation.
  const gamma = 2 * Math.PI / (leap ? 366 : 365) * (day - 1 + (minutes / 60 - 12) / 24);
  const eq = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const decl = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const ha = (mod(minutes + eq + 4 * settings.longitude!, 1440) / 4 - 180) * rad;
  const lat = settings.latitude! * rad;
  const elevation = Math.asin(clamp(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha), -1, 1)) / rad;
  const azimuth = mod(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / rad + 180, 360);
  return { azimuth, elevation, worldAzimuth: mod(azimuth + settings.northDegrees!, 360), aboveHorizon: elevation > 0, utcISO: utc.toISOString(), equationOfTimeMinutes: eq, declination: decl / rad };
}
/** Artistic RGB interpolation, not a colorimetric blackbody calculation. */
export function lampColor(kelvin: number): RGB {
  const t = clamp((kelvin - 1800) / 4700, 0, 1);
  return rgb(1, .62 + .36 * t, .3 + .7 * t);
}
export function atmosphereDirection(azimuth: number, elevation: number) {
  const a = azimuth * rad, e = elevation * rad;
  return { x: -Math.sin(a) * Math.cos(e), y: -Math.sin(e), z: Math.cos(a) * Math.cos(e) };
}
/** null means the existing editor/manual-sun lighting remains authoritative. */
export function resolveAtmosphere(value: SceneAtmosphereV1 | undefined): AtmosphereFrame | null {
  if (!value || value.mode === 'off') return null;
  const solar = value.mode === 'sun-study' ? solarPosition(value.study) : undefined;
  if (value.mode === 'sun-study' && !solar) return null;
  const mood = value.mood, elevation = solar?.elevation ?? mood.elevation, azimuth = solar?.worldAzimuth ?? mood.azimuth;
  const cloudiness = solar ? 0 : mood.cloudiness;
  const daylight = elevation > 0, twilight = clamp((elevation + 12) / 18, 0, 1), warm = 1 - clamp(elevation / 50, 0, 1);
  return { mode: value.mode, direction: atmosphereDirection(azimuth, elevation),
    sunIntensity: daylight ? 1.15 * (1 - cloudiness * .9) : 0,
    sunColor: rgb(1, 1 - .2 * warm, 1 - .4 * warm),
    skyIntensity: .12 + .32 * twilight, skyColor: rgb(.75 + .1 * twilight, .83 + .09 * twilight, 1), groundColor: rgb(.32, .34, .3),
    lampColor: lampColor(solar ? 2700 : mood.lampKelvin), lampIntensity: solar ? (daylight ? .65 : 1.7) : mood.lampBrightness,
    fixtureOverrides: solar ? {} : mood.fixtureOverrides,
    rain: solar ? 0 : mood.rain, windSpeed: solar ? 0 : mood.windSpeed, windDirection: mood.windDirection, animated: !solar && mood.animated, solar };
}
export function formatStudyTime(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`; }
export function parseStudyTime(value: string): number | undefined {
  if (!/^\d{2}:\d{2}$/.test(value)) return;
  const [h, m] = value.split(':').map(Number); return h < 24 && m < 60 ? h * 60 + m : undefined;
}
export function formatUTCOffset(minutes: number | null): string { return minutes === null ? 'Not set' : `UTC${minutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0')}:${String(Math.abs(minutes) % 60).padStart(2, '0')}`; }
export function saveAtmosphereSnapshot(value: SceneAtmosphereV1, name: string, id: string): SceneAtmosphereV1 {
  const trimmed = name.trim(); if (!trimmed || trimmed.length > 60 || !validId(id)) throw new Error('Use a name from 1 to 60 characters.');
  if (value.mode === 'off') throw new Error('Choose a mood or sun study first.');
  if (value.mode === 'sun-study' && studyProblems(value.study).length) throw new Error('Complete the sun-study settings before saving a comparison.');
  const key = value.mode === 'mood' ? 'savedMoods' : 'comparisons';
  if (value[key].length >= MAX_SAVED_ATMOSPHERES) throw new Error('Remove a saved entry before adding another (8 maximum).');
  if (value[key].some(entry => entry.id === id)) throw new Error('This saved entry already exists.');
  return value.mode === 'mood' ? { ...value, savedMoods: [...value.savedMoods, { id, name: trimmed, settings: structuredClone(value.mood) }] } : { ...value, comparisons: [...value.comparisons, { id, name: trimmed, settings: structuredClone(value.study) }] };
}
export function renameAtmosphereSnapshot(value: SceneAtmosphereV1, kind: 'savedMoods' | 'comparisons', id: string, name: string): SceneAtmosphereV1 {
  const trimmed = name.trim(); if (!trimmed || trimmed.length > 60) throw new Error('Use a name from 1 to 60 characters.');
  return { ...value, [kind]: value[kind].map(entry => entry.id === id ? { ...entry, name: trimmed } : entry) };
}

/** Public views retain the light direction, never the supplied location or saved study names. */
export function publicSceneAtmosphere(input:SceneAtmosphereV1):SceneAtmosphereV1 {
  const value=parseSceneAtmosphere(input),clean=defaultSceneAtmosphere('2000-01-01');
  if(!value)return clean;
  clean.mode=value.mode==='off'?'off':'mood';
  clean.mood=structuredClone(value.mood);
  if(value.mode==='sun-study'){
    const solar=solarPosition(value.study);
    if(!solar){clean.mode='off';return clean;}
    clean.mood={...clean.mood,azimuth:solar.worldAzimuth,elevation:Math.max(-30,solar.elevation),cloudiness:0,lampKelvin:2700,lampBrightness:solar.aboveHorizon?.65:1.7,fixtureOverrides:{},rain:0,windSpeed:0,animated:false};
  }
  return clean;
}
export function publicAtmospherePlan<T extends PlanDocumentV1>(plan:T):T {
  const atmosphere=plan.environment?.atmosphere;
  return {...plan,...(atmosphere?{environment:{...plan.environment!,atmosphere:publicSceneAtmosphere(atmosphere)}}:{}),...(plan.layoutAlternatives?{layoutAlternatives:{...plan.layoutAlternatives,options:plan.layoutAlternatives.options.map(option=>({...option,snapshot:{...option.snapshot,...(option.snapshot.environment?.atmosphere?{environment:{...option.snapshot.environment,atmosphere:publicSceneAtmosphere(option.snapshot.environment.atmosphere)}}:{})}}))}}:{})};
}
