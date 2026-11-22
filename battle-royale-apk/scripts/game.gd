extends Node3D

const PLAYER_SCRIPT = preload("res://scripts/player.gd")
const BOT_SCRIPT = preload("res://scripts/bot.gd")
var player: CharacterBody3D
var hud: CanvasLayer
var status_label: Label
var health := 100
var kills := 0
var zone_radius := 85.0
var elapsed := 0.0

func _ready() -> void:
	_build_world()
	_spawn_player()
	_spawn_bots()
	_build_hud()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _process(delta: float) -> void:
	elapsed += delta
	if elapsed > 20.0:
		zone_radius = maxf(18.0, zone_radius - delta * 0.7)
	_update_hud()

func _build_world() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.12, 0.22, 0.34)
	sky_mat.sky_horizon_color = Color(0.68, 0.66, 0.56)
	sky_mat.ground_bottom_color = Color(0.12, 0.16, 0.13)
	sky_mat.ground_horizon_color = Color(0.42, 0.43, 0.34)
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.68, 0.76)
	env.ambient_light_energy = 0.65
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = Color(0.62, 0.68, 0.67)
	env.fog_density = 0.0018
	world_env.environment = env
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	add_child(sun)

	_make_box("Ground", Vector3(0, -0.6, 0), Vector3(190, 1, 190), Color(0.25, 0.32, 0.23), true)
	_make_box("Road", Vector3(0, -0.04, 0), Vector3(15, 0.08, 190), Color(0.16, 0.17, 0.17), false)
	for i in range(-4, 5):
		_make_box("RoadMark", Vector3(0, 0.015, i * 19), Vector3(0.35, 0.025, 7), Color(0.83, 0.78, 0.57), false)
	for i in range(22):
		var x := randf_range(-78, 78)
		var z := randf_range(-78, 78)
		if absf(x) < 13 or absf(z) < 12:
			continue
		_make_tree(Vector3(x, 0, z))
	for p in [Vector3(-25,0,-24), Vector3(25,0,-32), Vector3(-35,0,28), Vector3(34,0,34), Vector3(7,0,48)]:
		_make_building(p)
	for i in range(18):
		var p := Vector3(randf_range(-65,65), 0, randf_range(-65,65))
		if absf(p.x) < 10:
			continue
		_make_box("Cover", p + Vector3(0, 0.7, 0), Vector3(randf_range(1.8,3.5),1.4,randf_range(1.8,3.5)), Color(0.38,0.35,0.28), true)

func _make_box(n: String, pos: Vector3, size: Vector3, color: Color, solid: bool) -> void:
	var body := StaticBody3D.new() if solid else Node3D.new()
	body.name = n
	body.position = pos
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.92
	mesh.material_override = mat
	body.add_child(mesh)
	if solid:
		var shape := CollisionShape3D.new()
		var s := BoxShape3D.new()
		s.size = size
		shape.shape = s
		body.add_child(shape)
	add_child(body)

func _make_tree(pos: Vector3) -> void:
	_make_cylinder(pos + Vector3(0,1.2,0), Vector3(0.38,2.4,0.38), Color(0.24,0.16,0.10), true)
	var crown := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 1.55
	mesh.height = 3.1
	crown.mesh = mesh
	crown.position = pos + Vector3(0,3.0,0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.12, randf_range(0.22,0.34), 0.16)
	mat.roughness = 1.0
	crown.material_override = mat
	add_child(crown)

func _make_cylinder(pos: Vector3, size: Vector3, color: Color, solid: bool) -> void:
	var body := StaticBody3D.new() if solid else Node3D.new()
	body.position = pos
	var mesh := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = size.x * 0.5
	c.bottom_radius = size.x * 0.5
	c.height = size.y
	mesh.mesh = c
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh.material_override = mat
	body.add_child(mesh)
	if solid:
		var col := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = size.x * 0.5
		shape.height = size.y
		col.shape = shape
		body.add_child(col)
	add_child(body)

func _make_building(pos: Vector3) -> void:
	var root := StaticBody3D.new()
	root.position = pos
	var wall := StandardMaterial3D.new()
	wall.albedo_color = Color(0.48,0.43,0.34)
	wall.roughness = 0.96
	var concrete := StandardMaterial3D.new()
	concrete.albedo_color = Color(0.25,0.27,0.25)
	concrete.roughness = 0.9
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.10,0.22,0.27)
	glass.metallic = 0.25
	glass.roughness = 0.22
	var body_mesh := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(12,6,10)
	body_mesh.mesh = b
	body_mesh.material_override = wall
	root.add_child(body_mesh)
	var col := CollisionShape3D.new()
	var cs := BoxShape3D.new()
	cs.size = b.size
	col.shape = cs
	root.add_child(col)
	# raised roof slab and perimeter trim
	_add_detail_box(root,Vector3(12.8,0.42,10.8),Vector3(0,3.18,0),concrete)
	_add_detail_box(root,Vector3(12.2,0.16,0.18),Vector3(0,2.55,-5.08),concrete)
	_add_detail_box(root,Vector3(12.2,0.16,0.18),Vector3(0,2.55,5.08),concrete)
	# front facade windows with frames
	for x in [-3.8,0.0,3.8]:
		_add_detail_box(root,Vector3(1.65,1.45,0.10),Vector3(x,0.75,-5.08),glass)
		_add_detail_box(root,Vector3(1.82,0.12,0.16),Vector3(x,1.53,-5.14),concrete)
		_add_detail_box(root,Vector3(0.12,1.58,0.16),Vector3(x-0.91,0.75,-5.14),concrete)
		_add_detail_box(root,Vector3(0.12,1.58,0.16),Vector3(x+0.91,0.75,-5.14),concrete)
		_add_detail_box(root,Vector3(0.08,1.42,0.18),Vector3(x,0.75,-5.17),concrete)
	# doorway and side windows
	_add_detail_box(root,Vector3(1.45,2.35,0.12),Vector3(0,-1.82,-5.10),_make_material(Color(0.12,0.13,0.12)))
	for z in [-2.8,2.8]:
		_add_detail_box(root,Vector3(0.10,1.35,1.65),Vector3(6.08,0.7,z),glass)
	# wall base strip
	_add_detail_box(root,Vector3(12.1,0.22,0.16),Vector3(0,-2.85,-5.1),concrete)
	add_child(root)

func _make_material(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.88
	return m

func _add_detail_box(parent: Node3D, size: Vector3, pos: Vector3, material: Material) -> void:
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	mesh.position = pos
	mesh.material_override = material
	parent.add_child(mesh)

func _spawn_player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	player.set_script(PLAYER_SCRIPT)
	player.position = Vector3(0, 1.1, 12)
	add_child(player)
	player.setup(self)

func _spawn_bots() -> void:
	for i in range(7):
		var bot := CharacterBody3D.new()
		bot.set_script(BOT_SCRIPT)
		bot.position = Vector3(randf_range(-48,48), 1, randf_range(-48,48))
		add_child(bot)
		bot.setup(self, i + 1)

func register_kill() -> void:
	kills += 1

func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var panel := ColorRect.new()
	panel.color = Color(0.025,0.04,0.055,0.72)
	panel.position = Vector2(18,18)
	panel.size = Vector2(280,82)
	hud.add_child(panel)
	status_label = Label.new()
	status_label.position = Vector2(32,28)
	status_label.add_theme_font_size_override("font_size", 20)
	status_label.add_theme_color_override("font_color", Color(0.94,0.96,0.9))
	hud.add_child(status_label)
	var help := Label.new()
	help.text = "MOVE: left stick     AIM: drag right side\nFIRE: red button     JUMP: blue button"
	help.position = Vector2(22, get_viewport().get_visible_rect().size.y - 72)
	help.add_theme_font_size_override("font_size", 15)
	help.add_theme_color_override("font_color", Color.WHITE)
	hud.add_child(help)
	var fire := _make_button("FIRE", Vector2(-142,-145), Color(0.72,0.12,0.10))
	fire.pressed.connect(func(): if is_instance_valid(player): player.fire())
	var jump := _make_button("JUMP", Vector2(-270,-90), Color(0.12,0.38,0.72))
	jump.pressed.connect(func(): if is_instance_valid(player): player.jump_now())
	var reload := _make_button("RELOAD", Vector2(-150,-55), Color(0.22,0.30,0.28))
	reload.pressed.connect(func(): if is_instance_valid(player): player.reload())

func _make_button(label_text: String, offset: Vector2, color: Color) -> Button:
	var b := Button.new()
	b.text = label_text
	b.size = Vector2(108,58)
	b.anchor_left = 1
	b.anchor_right = 1
	b.anchor_top = 1
	b.anchor_bottom = 1
	b.offset_left = offset.x
	b.offset_right = offset.x + 108
	b.offset_top = offset.y
	b.offset_bottom = offset.y + 58
	b.add_theme_font_size_override("font_size", 16)
	b.add_theme_color_override("font_color", Color.WHITE)
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	b.add_theme_stylebox_override("normal", style)
	hud.add_child(b)
	return b

func _update_hud() -> void:
	if status_label:
		var ammo = 0
		if is_instance_valid(player):
			ammo = player.get("ammo")
		status_label.text = "HP  %d     KILLS  %d\nAMMO  %d / 90     ZONE  %dm" % [health, kills, ammo, int(zone_radius)]
