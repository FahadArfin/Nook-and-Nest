from pathlib import Path
import runpy
EVIDENCE = {'objects': [{'bounds': {'max': [0.19489023089408875,
                                 0.2449132353067398,
                                 0.6457545757293701],
                         'min': [-0.19489023089408875,
                                 0.21831175684928894,
                                 0.2822759747505188],
                         'size': [0.3897804617881775,
                                  0.026601478457450867,
                                  0.3634786009788513]},
              'materials': ['modern-recess-charcoal'],
              'name': 'dark_recessed_interior',
              'vertices': 96}],
 'sourceBlend': {'bytes': 164460,
                 'path': 'assets-source/blender/rotating-cat-litter-box.blend',
                 'sha256': '3851eca0f70393d9dc5273d1daeb502b367972a5c4ce043619c6eafe71e5a135'}}

POLE = {'bounds': {'max': [0.2800000011920929, 0.3400000035762787, 0.75],
            'min': [-0.2800000011920929,
                    -0.21230466663837433,
                    0.1780305653810501],
            'size': [0.5600000023841858,
                     0.552304670214653,
                     0.5719694346189499]},
 'materials': ['wood-honey-textured'],
 'name': 'smooth_rotating_drum_shell',
 'vertices': 1536}

def apply(root,scene,item,material_keys,object_names):
    if item["id"] != 'rotating-cat-litter-box':raise ValueError("Wrong reviewed ID")
    changes = runpy.run_path(str(Path(__file__).with_name('utility_684.py')))["apply"](root,scene,item,material_keys,object_names,EVIDENCE)
    changes.append(runpy.run_path(str(Path(__file__).with_name("litter_drum_cap.py")))["apply"](scene,material_keys,object_names,POLE))
    return changes
