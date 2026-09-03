"""Original home-theatre miniatures. Named editable parts; Blender metres/Z up.

Type references: IKEA BESTA modular/cable-managed benches and Sonos compact
bookshelf speakers. No branded geometry, logos, artwork or textures are copied.
"""
import math


def media_builders(box, cyl, material, finish):
    def palette(m):
        return {**m, "screen": material("screen-midnight", (.028,.052,.064),None,.52),
                "body": material("cabinet-body", (.07,.085,.09),None,.88),
                "grille": material("speaker-grille", (.16,.17,.16),None,.99),
                "cone": material("speaker-cones", (.038,.044,.046),None,.95),
                "rim": material("speaker-driver-rims", (.24,.27,.26),None,.72),
                "stand": material("tv-feet", (.085,.1,.11),None,.82)}

    def tv(m, inches):
        m=palette(m)
        w,d,h={55:(1.238,.28,.795),65:(1.459,.30,.919),75:(1.680,.34,1.044)}[inches]
        screen_h=h-.11
        box("rounded_display_back",(w,.055,screen_h+.02),(0,0,h-(screen_h+.02)/2),m["body"],.016)
        box("recessed_screen",(w-.022,.009,screen_h-.006),(0,-.031,h-(screen_h+.02)/2),m["screen"],.009)
        box("lower_bezel",(w-.014,.014,.014),(0,-.035,.102),m["body"],.004)
        for x in (-w*.33,w*.33):
            box("splayed_foot",(.08,d,.035),(x,0,.0175),m["stand"],.013,(0,0,-x*.12))
            box("stand_neck",(.035,.04,.105),(x,.014,.075),m["stand"],.01,(0,x*.13,0))
        box("rear_electronics_housing",(w*.43,.032,screen_h*.40),(0,.034,screen_h*.5),m["body"],.018)
        box("subtle_standby_light",(.012,.008,.006),(w*.36,-.045,.097),m["green_light"],.002)
        return w,d,h

    def speaker(m, style):
        m=palette(m)
        dims={"compact":(.125,.14,.19),"bookshelf":(.20,.25,.34),"tower":(.28,.34,1.05),"bar":(.95,.13,.075),"sub":(.36,.40,.42)}
        w,d,h=dims[style]
        if style=="bar":
            box("soundbar_chassis",(w,d,h),(0,0,h/2),m["body"],.024)
            box("continuous_fabric_grille",(w-.025,.012,h*.68),(0,-d/2+.003,h*.49),m["grille"],.018)
            for x in (-.028,0,.028):box("top_touch_control",(.012,.017,.002),(x,0,h+.001),m["rim"],.005)
        elif style=="compact":
            box("soft_compact_speaker",(w,d,h-.015),(0,0,(h-.015)/2),m["grille"],.012)
            box("top_control_cap",(w*.93,d*.93,.015),(0,0,h-.0075),m["body"],.005)
            box("bottom_foot",(w*.79,d*.78,.009),(0,0,.0045),m["body"],.003)
            box("volume_groove",(.052,.009,.002),(0,-.022,h+.001),m["rim"],.003)
        else:
            foot=.035 if style=="tower" else .015
            box("speaker_enclosure",(w,d,h-foot),(0,0,(h+foot)/2),m["variant"],.023)
            box("recessed_baffle",(w*.89,.022,h-foot-.04),(0,-d/2-.003,(h+foot)/2),m["body"],.011)
            if style=="tower": drivers=[(.80,.039),(.61,.085),(.36,.085)];basew=w;based=d
            elif style=="sub": drivers=[(.215,.135)];basew=w*.85;based=d*.85
            else: drivers=[(.265,.025),(.13,.065)];basew=w*.83;based=d*.8
            for z,r in drivers:
                cyl("driver_rim",r+.009,.014,(0,-d/2-.019,z),m["rim"],28,(math.pi/2,0,0))
                cyl("recessed_driver_cone",r,.013,(0,-d/2-.029,z),m["cone"],28,(math.pi/2,0,0),.83)
                cyl("driver_dust_cap",r*.33,.014,(0,-d/2-.038,z),m["grille"],20,(math.pi/2,0,0))
            box("isolation_plinth",(basew,based,foot),(0,0,foot/2),m["body"],.009)
        return w,d,h

    def bench(m,style):
        m=palette(m);w,d,h={"slatted":(1.8,.44,.56),"open":(2.1,.45,.38),"cane":(1.6,.42,.66)}[style]
        base=.13 if style=="cane" else .10 if style=="slatted" else .04
        body_h=h-base-.05
        # Open carcass, not a solid box hidden behind fake shelves.
        box("continuous_wood_top",(w,d,.055),(0,0,h-.0275),m["wood"],.018)
        box("cabinet_base",(w-.035,d-.02,.045),(0,0,base+.0225),m["wood"],.013)
        for x in (-w/2+.025,w/2-.025):box("thick_end_panel",(.05,d-.025,body_h),(x,0,base+body_h/2),m["wood"],.012)
        for x in (-w/6,w/6):box("compartment_divider",(.035,d-.07,body_h),(x,.015,base+body_h/2),m["wood"],.008)
        # Two rear panels leave a central cable passage.
        for x in (-w*.33,w*.33):box("rear_panel",(w*.31,.025,body_h-.05),(x,d/2-.03,base+body_h/2),m["variant"],.008)
        box("equipment_shelf",(w/3-.05,d-.05,.035),(0,0,base+body_h*.5),m["wood"],.01)
        if style!="open":
            for sign in (-1,1):
                x=sign*w/3;doorw=w/3-.075;doorh=body_h-.035;y=-d/2-.008;z=base+body_h/2
                box("door_recess",(doorw,.023,doorh),(x,y,z),m["body"] if style=="slatted" else m["linen"],.007)
                if style=="slatted":
                    for n in range(12):box("individual_tambour_slat",(doorw/14,.022,doorh),(x-doorw/2+(n+.5)*doorw/12,y-.019,z),m["wood"],.007)
                else:
                    for n in (-1,1):
                        box("door_stile",(.035,.04,doorh),(x+n*(doorw-.035)/2,y-.012,z),m["wood"],.009)
                        box("door_rail",(doorw-.06,.04,.035),(x,y-.012,z+n*(doorh-.035)/2),m["wood"],.009)
                    # Readable broad cane lattice; texture supplies fine grain.
                    for n in range(7):box("cane_vertical",(.012,.008,doorh-.07),(x+(n-3)*doorw/9,y-.026,z),m["wood"],.003)
                    for n in range(4):box("cane_horizontal",(doorw-.07,.008,.012),(x,y-.03,z+(n-1.5)*doorh/5),m["wood"],.003)
        for x in (-w*.4,w*.4):
            for y in (-d*.31,d*.31):box("solid_tapered_foot",(.065,.065,base+.015),(x,y,base/2),m["wood_dark"],.014,(0,-x*.025,0))
        return w,d,h

    return {**{f"tv-{n}":lambda m,n=n:tv(m,n) for n in (55,65,75)},
            "compact-speaker":lambda m:speaker(m,"compact"),"bookshelf-speaker":lambda m:speaker(m,"bookshelf"),
            "tower-speaker":lambda m:speaker(m,"tower"),"soundbar":lambda m:speaker(m,"bar"),"subwoofer":lambda m:speaker(m,"sub"),
            "slatted-tv-stand":lambda m:bench(m,"slatted"),"open-media-bench":lambda m:bench(m,"open"),"cane-tv-stand":lambda m:bench(m,"cane")}
