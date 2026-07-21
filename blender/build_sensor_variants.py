"""Generate presentation-grade non-contact sensor variants from the supplied LVDT station.

Run through Blender in background mode. The source .blend is never modified; each
variant is saved as a standalone .blend and web-ready GLB in public/models.
"""
import bpy
import math
import os
from mathutils import Vector

SOURCE = r"C:\Users\mrunmai khumkar\Documents\Codex\2026-07-13\computer-plugin-computer-use-openai-bundled\outputs\industrial_radiator_fin_inspection_hollow.blend"
OUT = r"C:\Users\mrunmai khumkar\Documents\mahle\public\models"

def material(name, color, metallic=0.0, rough=.35, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1)
        p.inputs["Emission Strength"].default_value = 4.0
    return m

BLACK = ALLOY = CYAN = VIOLET = AMBER = GLASS = None

def collection(name):
    col=bpy.data.collections.get(name)
    if col: bpy.data.collections.remove(col, do_unlink=True)
    col=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(col); return col

def place(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj); return obj

def cube(name, loc, scale, mat, col, bevel=.05):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat); place(o,col)
    if bevel: b=o.modifiers.new("Precision edge radius",'BEVEL'); b.width=bevel; b.segments=3
    return o

def cyl(name, loc, radius, depth, mat, col, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=depth, location=loc, rotation=rot); o=bpy.context.object; o.name=name; o.data.materials.append(mat); place(o,col); return o

def torus(name, loc, major, minor, mat, col, rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=48, minor_segments=12, location=loc, rotation=rot); o=bpy.context.object; o.name=name; o.data.materials.append(mat); place(o,col); return o

def text(name, body, loc, size, mat, col):
    bpy.ops.object.text_add(location=loc, rotation=(math.radians(74),0,0)); o=bpy.context.object; o.name=name; o.data.body=body; o.data.align_x='CENTER'; o.data.size=size; o.data.extrude=.008; o.data.materials.append(mat); place(o,col); return o

def hide_contact_sensor():
    for o in bpy.context.scene.objects:
        if any(x in o.name.lower() for x in ('lvdt','ruby ball','laser measurement plane')):
            o.hide_render=True; o.hide_viewport=True

def export_variant(name, col):
    # Make the emitted components visible in GLB and preserve the whole station.
    for o in bpy.context.scene.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.context.scene.objects.get('Camera.001')
    blend=os.path.join(OUT, name+'.blend'); glb=os.path.join(OUT, name+'.glb')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_materials='EXPORT', export_cameras=True, export_lights=True, export_animations=True, export_apply=True)
    print('EXPORTED', blend, glb)

def reset_source():
    global BLACK, ALLOY, CYAN, VIOLET, AMBER, GLASS
    bpy.ops.wm.open_mainfile(filepath=SOURCE)
    bpy.context.scene.render.engine='BLENDER_EEVEE'
    bpy.context.scene.world.color=(.006,.012,.018)
    # Opening the source clears datablocks, so recreate these materials per scene.
    BLACK = material("Sensor graphite", (.025,.045,.06), .7, .22)
    ALLOY = material("Sensor alloy", (.32,.42,.49), .86, .2)
    CYAN = material("Optical cyan", (.02,.72,1.0), .15, .18, (.02,.72,1.0))
    VIOLET = material("Vision violet", (.36,.2,1.0), .2, .18, (.36,.2,1.0))
    AMBER = material("Encoder amber", (1.0,.35,.025), .1, .2, (1.0,.35,.025))
    GLASS = material("Lens glass", (.04,.17,.25), .2, .08, (.02,.45,.8))
    hide_contact_sensor()

def laser_variant():
    reset_source(); col=collection('SOLUTION_01_LASER_TRIANGULATION')
    # Head centered above fin 07 / location follows the native C-frame geometry.
    cube('Laser bridge carriage',(0,0,3.63),(1.35,.48,.14),BLACK,col,.08)
    cube('Laser vertical arm',(0,.03,3.05),(.18,.38,.65),ALLOY,col,.06)
    head=cube('Blue laser triangulation sensor',(0,-.02,2.48),(.42,.5,.26),BLACK,col,.1)
    cube('Laser anodized face',(0,-.535,2.48),(.3,.025,.17),ALLOY,col,.02)
    cyl('Laser objective lens',(0,-.57,2.48),.11,.04,GLASS,col,(math.radians(90),0,0))
    torus('Laser status halo',(0,-.59,2.48),.15,.018,CYAN,col,(math.radians(90),0,0))
    # scanning plane and visible metrology beam
    cube('Laser measurement beam',(0,-.03,1.43),(.012,.025,1.0),CYAN,col,.0)
    cube('Laser scan line',(0,-.1,.48),(1.25,.018,.018),CYAN,col,.0)
    text('Laser label','LASER TRIANGULATION',(0,-.5,3.28),.19,CYAN,col)
    text('Laser data label','< 30 um REPEATABILITY',(0,-.5,3.0),.105,ALLOY,col)
    export_variant('laser_triangulation_station', col)

def vision_variant():
    reset_source(); col=collection('SOLUTION_02_STEREO_VISION_ENCODER')
    cube('Vision bridge carriage',(0,0,3.63),(1.55,.5,.14),BLACK,col,.08)
    cube('Vision mast',(0,.02,3.02),(.18,.4,.72),ALLOY,col,.06)
    for x,label in [(-.48,'LEFT CAMERA'),(.48,'RIGHT CAMERA')]:
        cube(label,(x,-.04,2.55),(.31,.42,.26),BLACK,col,.08)
        cyl(label+' lens',(x,-.49,2.55),.13,.05,GLASS,col,(math.radians(90),0,0))
        torus(label+' ring',(x,-.525,2.55),.17,.018,VIOLET,col,(math.radians(90),0,0))
        cube(label+' bracket',(x,0,2.85),(.07,.18,.25),ALLOY,col,.03)
    cube('Vision reconstruction volume',(0,-.05,1.48),(1.1,.04,.95),VIOLET,col,.0)
    # encoder at conveyor end, with illuminated index mark
    cyl('Encoder body',(4.65,-.83,.62),.29,.2,BLACK,col,(math.radians(90),0,0))
    cyl('Encoder dial',(4.65,-.96,.62),.2,.025,ALLOY,col,(math.radians(90),0,0))
    for a in range(12):
        x=4.65+math.cos(a*math.pi/6)*.16; z=.62+math.sin(a*math.pi/6)*.16
        cube('Encoder tick',(x,-.985,z),(.012,.012,.025),AMBER,col,.0)
    text('Vision label','STEREO VISION + ENCODER',(0,-.5,3.28),.18,VIOLET,col)
    text('Vision data label','FULL PROFILE TRACEABILITY',(0,-.5,3.0),.105,ALLOY,col)
    export_variant('stereo_vision_encoder_station', col)

os.makedirs(OUT, exist_ok=True)
laser_variant()
vision_variant()
