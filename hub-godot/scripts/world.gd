extends Node3D

const FirebaseHub = preload("res://scripts/firebase_hub.gd")
const MOVE_SPEED := 5.2
const JUMP_VELOCITY := 5.8
var player: CharacterBody3D
var camera: Camera3D
var camera_yaw := 0.0
var camera_pitch := -0.22
var active_look := false
var active_move := false
var move_origin := Vector2.ZERO
var move_touch := Vector2.ZERO
var jump_requested := false
var ui_layer: CanvasLayer
var animated_legs: Array[Node3D] = []
var animated_arms: Array[Node3D] = []
var animation_clock := 0.0
var sprint_enabled := false
var attraction_wheels: Array[Node3D] = []
var status_label: Label
var run_button: Button
var jump_button: Button
var settings_panel: PanelContainer
var hud_scale := 1.0
var local_name_tag: Label3D
var firebase_bridge
var avatar_scene: PackedScene
var arabic_font: Font
var avatar_animation_state := "idle"
var firebase_uid := ""
var firebase_send_clock := 0.0
var remote_avatars: Dictionary = {}
var remote_targets: Dictionary = {}
var remote_yaws: Dictionary = {}
var portal_enter_button: Button
var nearby_portal_url := ""
var nearby_portal_label := ""
var joystick_base: ColorRect
var joystick_knob: ColorRect

func _ready() -> void:
	_build_environment()
	_build_player()
	_build_camera()
	arabic_font = load("res://assets/Cairo.ttf") as Font if ResourceLoader.exists("res://assets/Cairo.ttf") else null
	_build_hud()
	_load_professional_avatar()
	if not has_meta("skip_firebase"):
		firebase_bridge = FirebaseHub.new()
		add_child(firebase_bridge)
		firebase_bridge.connected.connect(_on_firebase_connected)
		firebase_bridge.players_changed.connect(_on_firebase_players_changed)
		firebase_bridge.failed.connect(_on_firebase_failed)
		firebase_bridge.start()

func _build_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	e.sky = Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.025, 0.07, 0.15)
	sky_mat.sky_horizon_color = Color(0.23, 0.31, 0.42)
	sky_mat.ground_bottom_color = Color(0.025, 0.045, 0.07)
	sky_mat.ground_horizon_color = Color(0.12, 0.17, 0.22)
	e.sky.sky_material = sky_mat
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.43, 0.55, 0.72)
	e.ambient_light_energy = 0.65
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.glow_enabled = true
	e.fog_enabled = true
	e.fog_light_color = Color(0.16, 0.24, 0.34)
	e.fog_density = 0.006
	e.fog_sun_scatter = 0.12
	e.adjustment_enabled = true
	e.adjustment_brightness = 1.04
	e.adjustment_contrast = 1.12
	e.adjustment_saturation = 1.08
	env.environment = e
	add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_color = Color(0.72, 0.82, 1.0)
	sun.light_energy = 0.8
	sun.shadow_enabled = true
	add_child(sun)

	_make_box("Island", Vector3(0, -0.5, 0), Vector3(70, 1, 70), Color(0.12, 0.25, 0.22))
	_make_box("Main promenade", Vector3(0, 0.02, 0), Vector3(12, 0.12, 34), Color(0.43, 0.46, 0.48))
	_make_box("Central plaza", Vector3(0, 0.08, -8), Vector3(24, 0.18, 17), Color(0.57, 0.55, 0.49))
	_make_box("Beach sand", Vector3(0, -0.05, 25), Vector3(70, 0.2, 12), Color(0.72, 0.62, 0.42))
	_make_ocean()
	_make_landscape_details()

	for x in [-5.0, 5.0]:
		for z in [-20.0, -12.0, -4.0, 4.0, 12.0]:
			_make_lamp(Vector3(x, 0, z))
	for x in [-15.0, -11.0, 11.0, 15.0]:
		for z in [-20.0, -12.0, -4.0, 4.0, 12.0]:
			_make_tree(Vector3(x, 0, z))
	_make_attraction(Vector3(-15, 0, -10))
	_make_cafe(Vector3(15, 0, -12))
	_make_sign(Vector3(0, 0, -18), "LAMMA SOCIAL WORLD")
	_make_portal(Vector3(-8, 0, -11), "لودو أونلاين", "../games/ludo-online.html", Color("#69d6b4"))
	_make_portal(Vector3(8, 0, -11), "كونكت 4", "../games/connect-four.html", Color("#72b7ff"))
	_make_portal(Vector3(-8, 0, -3), "معركة القمم", "../games/m3rakat-alqimam.html", Color("#ed9a69"))
	_make_portal(Vector3(8, 0, -3), "غرفة الكوتشينة", "../games/card-room.html?game=tarneeb", Color("#c69bff"))
	_make_portal(Vector3(-8, 0, 5), "ارسم وخمّن", "../games/draw-guess.html", Color("#f1cf6f"))
	_make_portal(Vector3(8, 0, 5), "تحدي الأسئلة", "../quiz.html?mode=online", Color("#6ddce5"))

func _make_material(color: Color, roughness := 0.8, metallic := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	m.metallic = metallic
	return m

func _make_box(label: String, pos: Vector3, size: Vector3, color: Color, roughness := 0.85) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.position = pos
	node.material_override = _make_material(color, roughness)
	add_child(node)
	var body := StaticBody3D.new()
	body.position = pos
	var shape_node := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape_node.shape = box
	body.add_child(shape_node)
	add_child(body)
	return node



func _make_portal(pos: Vector3, label: String, target_url: String, tint: Color) -> void:
	var portal := Node3D.new()
	portal.name = "Portal_" + label.replace(" ", "_")
	portal.position = pos
	add_child(portal)
	var frame_material := _make_material(tint, 0.22, 0.35)
	for side in [-1.0, 1.0]:
		var pillar := MeshInstance3D.new()
		var pillar_mesh := BoxMesh.new()
		pillar_mesh.size = Vector3(0.32, 3.25, 0.42)
		pillar.mesh = pillar_mesh
		pillar.position = Vector3(side * 1.55, 1.62, 0)
		pillar.material_override = frame_material
		portal.add_child(pillar)
	var top := MeshInstance3D.new()
	var top_mesh := BoxMesh.new()
	top_mesh.size = Vector3(3.4, 0.32, 0.42)
	top.mesh = top_mesh
	top.position = Vector3(0, 3.25, 0)
	top.material_override = frame_material
	portal.add_child(top)
	var gate_surface := MeshInstance3D.new()
	var surface_mesh := PlaneMesh.new()
	surface_mesh.size = Vector2(2.7, 2.85)
	gate_surface.mesh = surface_mesh
	gate_surface.position = Vector3(0, 1.68, -0.12)
	gate_surface.rotation.x = deg_to_rad(90)
	var surface_material := StandardMaterial3D.new()
	surface_material.albedo_color = Color(tint.r, tint.g, tint.b, 0.2)
	surface_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	surface_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	surface_material.emission_enabled = true
	surface_material.emission = tint
	surface_material.emission_energy_multiplier = 0.7
	gate_surface.material_override = surface_material
	portal.add_child(gate_surface)
	var title_tag := Label3D.new()
	title_tag.text = label
	title_tag.position = Vector3(0, 3.75, 0.05)
	title_tag.font_size = 30
	title_tag.modulate = tint.lightened(0.35)
	portal.add_child(title_tag)
	var area := Area3D.new()
	area.name = "PortalTrigger"
	var trigger_shape := CollisionShape3D.new()
	var trigger_box := BoxShape3D.new()
	trigger_box.size = Vector3(3.3, 3.1, 1.7)
	trigger_shape.shape = trigger_box
	trigger_shape.position = Vector3(0, 1.55, 0)
	area.add_child(trigger_shape)
	portal.add_child(area)
	area.body_entered.connect(func(body: Node3D):
		if body == player:
			_on_portal_enter(label, target_url)
	)
	area.body_exited.connect(func(body: Node3D):
		if body == player:
			_on_portal_exit(target_url)
	)

func _on_portal_enter(label: String, target_url: String) -> void:
	nearby_portal_label = label
	nearby_portal_url = target_url
	if is_instance_valid(portal_enter_button):
		portal_enter_button.text = "دخول: " + label
		portal_enter_button.visible = true

func _on_portal_exit(target_url: String) -> void:
	if nearby_portal_url == target_url:
		nearby_portal_url = ""
		nearby_portal_label = ""
		if is_instance_valid(portal_enter_button):
			portal_enter_button.visible = false

func _enter_nearby_portal() -> void:
	if nearby_portal_url.is_empty():
		return
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.location.href = " + JSON.stringify(nearby_portal_url) + ";", true)

func _make_ocean() -> void:
	var water_mesh := PlaneMesh.new()
	water_mesh.size = Vector2(180, 180)
	water_mesh.subdivide_width = 80
	water_mesh.subdivide_depth = 80
	var water := MeshInstance3D.new()
	water.name = "AnimatedOcean"
	water.mesh = water_mesh
	water.position = Vector3(0, -0.22, 35)
	var water_shader := Shader.new()
	water_shader.code = """
	shader_type spatial;
	render_mode cull_back, depth_draw_opaque;
	uniform vec4 deep_water : source_color = vec4(0.012, 0.09, 0.17, 1.0);
	uniform vec4 light_water : source_color = vec4(0.035, 0.30, 0.39, 1.0);
	void vertex() {
		float wave_a = sin(VERTEX.x * 0.18 + TIME * 0.8) * 0.11;
		float wave_b = cos(VERTEX.z * 0.15 - TIME * 0.65) * 0.08;
		VERTEX.y += wave_a + wave_b;
	}
	void fragment() {
		float ripple = sin(UV.x * 140.0 + TIME * 1.1) * cos(UV.y * 115.0 - TIME * 0.9);
		float depth = clamp(0.35 + ripple * 0.08 + UV.y * 0.18, 0.0, 1.0);
		float fresnel = pow(1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0), 3.0);
		ALBEDO = mix(deep_water.rgb, light_water.rgb, depth) + vec3(0.02, 0.04, 0.05) * max(ripple, 0.0);
		ROUGHNESS = 0.16;
		METALLIC = 0.22;
		SPECULAR = 0.9;
		EMISSION = vec3(0.005, 0.025, 0.04) + fresnel * vec3(0.02, 0.12, 0.15);
	}
	"""
	var water_material := ShaderMaterial.new()
	water_material.shader = water_shader
	water.material_override = water_material
	add_child(water)

func _make_landscape_details() -> void:
	for side in [-1.0, 1.0]:
		_make_box("Promenade stone border", Vector3(side * 6.15, 0.105, 0), Vector3(0.28, 0.16, 34), Color("#263746"), 0.42)
		_make_box("Warm path inset", Vector3(side * 5.82, 0.112, 0), Vector3(0.055, 0.025, 33), Color("#b49a70"), 0.38)
		for z in [-15.0, -9.0, -3.0, 3.0, 9.0, 15.0]:
			_make_box("Ground guide light", Vector3(side * 5.55, 0.16, z), Vector3(0.12, 0.035, 0.65), Color("#8bd9d0"), 0.25)
			var glow := OmniLight3D.new()
			glow.position = Vector3(side * 5.55, 0.42, z)
			glow.light_color = Color("#69cfc8")
			glow.light_energy = 0.22
			glow.omni_range = 2.4
			add_child(glow)
	for x in [-9.0, -3.0, 3.0, 9.0]:
		_make_box("Plaza stone seam", Vector3(x, 0.176, -8), Vector3(0.035, 0.012, 16.2), Color("#777b7d"), 0.9)
	for z in [-14.0, -8.0, -2.0]:
		_make_box("Plaza stone seam", Vector3(0, 0.176, z), Vector3(23.5, 0.012, 0.035), Color("#777b7d"), 0.9)
	for side in [-1.0, 1.0]:
		for z in [-16.0, -7.0, 2.0, 11.0]:
			_make_box("Landscape planter", Vector3(side * 13.0, 0.32, z), Vector3(2.0, 0.62, 3.2), Color("#263b3a"), 0.78)
			_make_box("Planter soil", Vector3(side * 13.0, 0.65, z), Vector3(1.72, 0.08, 2.92), Color("#30291f"), 1.0)
			for i in range(3):
				var shrub := MeshInstance3D.new()
				var shrub_mesh := SphereMesh.new()
				shrub_mesh.radius = 0.48
				shrub_mesh.height = 0.82
				shrub.mesh = shrub_mesh
				shrub.position = Vector3(side * 13.0 + (float(i) - 1.0) * 0.52, 1.0, z + (float(i % 2) - 0.5) * 0.6)
				shrub.material_override = _make_material(Color("#174a35"), 0.95)
				add_child(shrub)

func _make_tree(pos: Vector3) -> void:
	var trunk := MeshInstance3D.new()
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.18
	trunk_mesh.bottom_radius = 0.28
	trunk_mesh.height = 2.3
	trunk.mesh = trunk_mesh
	trunk.position = pos + Vector3(0, 1.15, 0)
	trunk.material_override = _make_material(Color(0.25, 0.14, 0.09))
	add_child(trunk)
	var crown := MeshInstance3D.new()
	var crown_mesh := SphereMesh.new()
	crown_mesh.radius = 0.9
	crown_mesh.height = 1.8
	crown.mesh = crown_mesh
	crown.position = pos + Vector3(0, 2.65, 0)
	crown.scale = Vector3(1.0, 1.15, 1.0)
	crown.material_override = _make_material(Color(0.035, 0.19, 0.13), 0.92)
	add_child(crown)
	for cluster in range(4):
		var leaf := MeshInstance3D.new()
		var leaf_mesh := SphereMesh.new()
		leaf_mesh.radius = 0.58
		leaf_mesh.height = 1.12
		leaf.mesh = leaf_mesh
		var angle := TAU * float(cluster) / 4.0
		leaf.position = pos + Vector3(cos(angle) * 0.62, 2.85 + float(cluster % 2) * 0.24, sin(angle) * 0.62)
		leaf.material_override = _make_material(Color("#123d2b") if cluster % 2 == 0 else Color("#19543a"), 0.95)
		add_child(leaf)
	var body := StaticBody3D.new()
	body.position = pos + Vector3(0, 1.2, 0)
	var collision := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.48
	shape.height = 2.4
	collision.shape = shape
	body.add_child(collision)
	add_child(body)

func _make_lamp(pos: Vector3) -> void:
	var pole := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.055
	pm.bottom_radius = 0.09
	pm.height = 3.5
	pole.mesh = pm
	pole.position = pos + Vector3(0, 1.75, 0)
	pole.material_override = _make_material(Color(0.12, 0.16, 0.2), 0.35, 0.7)
	add_child(pole)
	var bulb := MeshInstance3D.new()
	var bm := SphereMesh.new()
	bm.radius = 0.22
	bm.height = 0.3
	bulb.mesh = bm
	bulb.position = pos + Vector3(0, 3.5, 0)
	bulb.material_override = _make_material(Color(1.0, 0.78, 0.43), 0.2, 0.0)
	add_child(bulb)
	var light := OmniLight3D.new()
	light.position = pos + Vector3(0, 3.4, 0)
	light.light_color = Color(1.0, 0.69, 0.37)
	light.light_energy = 1.25
	light.omni_range = 8.0
	add_child(light)

func _make_attraction(pos: Vector3) -> void:
	var wheel := Node3D.new()
	wheel.name = "AnimatedFerrisWheel"
	wheel.position = pos + Vector3(0, 4.0, 0)
	add_child(wheel)
	attraction_wheels.append(wheel)
	var ring_node := MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 2.2
	ring.outer_radius = 2.45
	ring_node.mesh = ring
	ring_node.rotation.x = deg_to_rad(90)
	ring_node.material_override = _make_material(Color(0.9, 0.38, 0.58), 0.35, 0.25)
	wheel.add_child(ring_node)
	for i in range(8):
		var angle := TAU * float(i) / 8.0
		var cabin := MeshInstance3D.new()
		var cm := BoxMesh.new()
		cm.size = Vector3(0.8, 0.9, 0.7)
		cabin.mesh = cm
		cabin.position = Vector3(cos(angle) * 2.3, sin(angle) * 2.3, 0)
		var colors := [Color("#e58d9d"), Color("#76c9c4"), Color("#e9c36c"), Color("#8d9ee6")]
		cabin.material_override = _make_material(colors[i % 4])
		wheel.add_child(cabin)
	var support := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.22, 8.0, 0.22)
	support.mesh = sm
	support.position = pos + Vector3(0, 4, 0)
	support.material_override = _make_material(Color(0.18, 0.23, 0.3), 0.35, 0.5)
	add_child(support)

func _make_cafe(pos: Vector3) -> void:
	_make_box("Cafe building", pos + Vector3(0, 1.7, 0), Vector3(7, 3.4, 5), Color(0.25, 0.31, 0.39))
	_make_box("Cafe roof", pos + Vector3(0, 3.55, 0), Vector3(7.6, 0.35, 5.6), Color(0.16, 0.62, 0.52))
	_make_box("Cafe window", pos + Vector3(0, 1.9, -2.56), Vector3(4.2, 1.5, 0.08), Color(0.1, 0.42, 0.55), 0.2)

func _make_sign(pos: Vector3, label: String) -> void:
	_make_box("Welcome sign", pos + Vector3(0, 2.1, 0), Vector3(8, 2.3, 0.35), Color(0.035, 0.12, 0.17))
	var text_3d := Label3D.new()
	text_3d.text = label
	if arabic_font != null:
		text_3d.font = arabic_font
	text_3d.font_size = 48
	text_3d.position = pos + Vector3(0, 2.15, 0.2)
	text_3d.modulate = Color(0.55, 1.0, 0.84)
	text_3d.pixel_size = 0.008
	add_child(text_3d)

func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "LammaGirl"
	player.position = Vector3(0, 0.1, 5)
	var capsule := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.8
	capsule.shape = cap
	capsule.position.y = 0.9
	player.add_child(capsule)
	_build_girl_model(player)
	local_name_tag = Label3D.new()
	local_name_tag.name = "LocalPlayerName"
	local_name_tag.text = "لاعب"
	if arabic_font != null:
		local_name_tag.font = arabic_font
	local_name_tag.position = Vector3(0, 2.08, 0)
	local_name_tag.font_size = 30
	local_name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	local_name_tag.modulate = Color("#e7fff7")
	player.add_child(local_name_tag)
	add_child(player)

func _part(parent: Node3D, part_name: String, mesh: Mesh, pos: Vector3, color: Color, scale := Vector3.ONE) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.name = part_name
	part.mesh = mesh
	part.position = pos
	part.scale = scale
	part.material_override = _make_material(color, 0.72)
	parent.add_child(part)
	return part

func _sphere(parent: Node3D, part_name: String, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	return _part(parent, part_name, mesh, pos, color, size)

func _build_girl_model(root: Node3D, track_local_animation := true) -> void:
	var skin := Color("#f3c6a9")
	var hair := Color("#39233b")
	var dress := Color("#7c75d8")
	var white := Color("#f7edf0")
	var body := Node3D.new()
	body.name = "StylizedGirlAvatar"
	root.add_child(body)
	_sphere(body, "Torso", Vector3(0, 1.18, 0), Vector3(0.64, 0.82, 0.36), dress)
	_sphere(body, "Neck", Vector3(0, 1.72, 0), Vector3(0.22, 0.26, 0.22), skin)
	_sphere(body, "Head", Vector3(0, 2.02, 0), Vector3(0.62, 0.72, 0.57), skin)
	_sphere(body, "Hair cap", Vector3(0, 2.29, -0.06), Vector3(0.67, 0.43, 0.62), hair)
	_sphere(body, "Hair back", Vector3(0, 1.82, -0.25), Vector3(0.62, 1.0, 0.38), hair)
	_sphere(body, "Hair left", Vector3(-0.38, 1.98, -0.02), Vector3(0.2, 0.78, 0.28), hair)
	_sphere(body, "Hair right", Vector3(0.38, 1.98, -0.02), Vector3(0.2, 0.78, 0.28), hair)
	_sphere(body, "Side fringe", Vector3(-0.22, 2.23, 0.36), Vector3(0.28, 0.24, 0.2), hair)
	_sphere(body, "Eye left", Vector3(-0.16, 2.08, 0.48), Vector3(0.075, 0.105, 0.045), Color("#38243b"))
	_sphere(body, "Eye right", Vector3(0.16, 2.08, 0.48), Vector3(0.075, 0.105, 0.045), Color("#38243b"))
	_sphere(body, "Eye shine left", Vector3(-0.18, 2.12, 0.52), Vector3(0.025, 0.03, 0.018), white)
	_sphere(body, "Eye shine right", Vector3(0.14, 2.12, 0.52), Vector3(0.025, 0.03, 0.018), white)
	_sphere(body, "Blush left", Vector3(-0.27, 1.96, 0.43), Vector3(0.11, 0.055, 0.025), Color("#e99a9b"))
	_sphere(body, "Blush right", Vector3(0.27, 1.96, 0.43), Vector3(0.11, 0.055, 0.025), Color("#e99a9b"))
	_sphere(body, "Smile", Vector3(0, 1.91, 0.49), Vector3(0.09, 0.035, 0.025), Color("#b65d6e"))
	_sphere(body, "Skirt", Vector3(0, 0.77, 0), Vector3(0.76, 0.56, 0.48), Color("#a9a1ec"))
	var ponytail := _sphere(body, "Long ponytail", Vector3(0, 1.72, -0.48), Vector3(0.3, 0.85, 0.32), hair)
	ponytail.rotation.x = -0.22
	for side in [-1.0, 1.0]:
		var arm_pivot := Node3D.new()
		arm_pivot.name = "ArmPivot"
		arm_pivot.position = Vector3(side * 0.43, 1.48, 0)
		body.add_child(arm_pivot)
		_sphere(arm_pivot, "Upper arm", Vector3(0, -0.25, 0), Vector3(0.23, 0.58, 0.24), dress)
		_sphere(arm_pivot, "Hand", Vector3(0, -0.55, 0.02), Vector3(0.2, 0.22, 0.2), skin)
		if track_local_animation:
			animated_arms.append(arm_pivot)
		var leg_pivot := Node3D.new()
		leg_pivot.name = "LegPivot"
		leg_pivot.position = Vector3(side * 0.2, 0.57, 0)
		body.add_child(leg_pivot)
		_sphere(leg_pivot, "Leg", Vector3(0, -0.25, 0), Vector3(0.23, 0.62, 0.24), skin)
		_sphere(leg_pivot, "Shoe", Vector3(0, -0.54, 0.09), Vector3(0.3, 0.16, 0.43), white)
		if track_local_animation:
			animated_legs.append(leg_pivot)

func _load_professional_avatar() -> void:
	var avatar_path := "res://assets/lamma_girl.glb"
	if not ResourceLoader.exists(avatar_path):
		push_error("Professional avatar resource is missing from the exported project: " + avatar_path)
		return
	var loaded_avatar: Resource = load(avatar_path)
	if loaded_avatar == null or not loaded_avatar is PackedScene:
		push_error("Godot did not import the GLB as a PackedScene: " + avatar_path)
		return
	avatar_scene = loaded_avatar as PackedScene
	_apply_professional_avatar(player)
	for uid in remote_avatars:
		_apply_professional_avatar(remote_avatars[uid])
	print("Lamma professional rigged avatar loaded from imported GLB resource.")

func _apply_professional_avatar(target: Node3D) -> void:
	if avatar_scene == null or not is_instance_valid(target):
		return
	var fallback := target.get_node_or_null("StylizedGirlAvatar")
	if fallback != null:
		target.remove_child(fallback)
		fallback.queue_free()
	var old_avatar := target.get_node_or_null("ProfessionalGirlAvatar")
	if old_avatar != null:
		target.remove_child(old_avatar)
		old_avatar.queue_free()
	var model := avatar_scene.instantiate()
	model.name = "ProfessionalGirlAvatar"
	# The imported GLB faces +Z; the player controller faces -Z at yaw 0.
	# Keep the correction on the visual root so physics/camera yaw stay consistent.
	model.rotation.y = PI
	model.scale = Vector3.ONE
	target.add_child(model)
	_play_avatar_animation(model, "idle")

func _play_avatar_animation(model: Node, wanted: String) -> void:
	var players := model.find_children("*", "AnimationPlayer", true, false)
	for item in players:
		var anim_player := item as AnimationPlayer
		var chosen := ""
		for animation_name in anim_player.get_animation_list():
			var lowered := animation_name.to_lower()
			if wanted == "run" and lowered.contains("run"):
				chosen = animation_name
				break
			if wanted == "walk" and (lowered.contains("walk") or lowered.contains("run")):
				chosen = animation_name
				break
			if wanted == "jump" and (lowered.contains("jump") or lowered.contains("fall")):
				chosen = animation_name
				break
			if wanted == "idle" and (lowered.contains("idle") or lowered.contains("stand")):
				chosen = animation_name
				break
		if chosen == "" and wanted == "run":
			for animation_name in anim_player.get_animation_list():
				var lowered := animation_name.to_lower()
				if lowered.contains("walk") or lowered.contains("run"):
					chosen = animation_name
					break
		if chosen != "" and anim_player.current_animation != chosen:
			# A short cross-fade prevents the hard pose snap between idle and locomotion.
			anim_player.play(chosen, 0.22)

func _set_avatar_animation_speed(model: Node, movement_speed: float, wanted: String) -> void:
	if model == null:
		return
	var scale := 1.0
	if wanted == "walk":
		scale = clampf(movement_speed / maxf(MOVE_SPEED, 0.1), 0.72, 1.35)
	elif wanted == "run":
		scale = clampf(movement_speed / (MOVE_SPEED * 1.65), 0.85, 1.25)
	for item in model.find_children("*", "AnimationPlayer", true, false):
		var anim_player := item as AnimationPlayer
		anim_player.speed_scale = scale

func _set_local_avatar_motion(speed: float, on_floor: bool) -> void:
	if avatar_scene == null or not is_instance_valid(player):
		return
	var wanted := "idle"
	if not on_floor:
		wanted = "jump"
	elif speed > MOVE_SPEED * 1.25:
		wanted = "run"
	elif speed > 0.35:
		wanted = "walk"
	var model := player.get_node_or_null("ProfessionalGirlAvatar")
	if model != null:
		if wanted != avatar_animation_state:
			avatar_animation_state = wanted
			_play_avatar_animation(model, wanted)
		_set_avatar_animation_speed(model, speed, wanted)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FollowCamera"
	camera.current = true
	camera.fov = 70
	add_child(camera)
	_update_camera()

func _update_camera(delta := 1.0) -> void:
	if not is_instance_valid(player):
		return
	var target := player.global_position + Vector3(0, 1.55, 0)
	var offset := Vector3(sin(camera_yaw) * 7.0, 3.2 - camera_pitch * 2.0, cos(camera_yaw) * 7.0)
	camera.global_position = camera.global_position.lerp(target + offset, 1.0 - exp(-8.0 * delta))
	camera.look_at(target, Vector3.UP)

func _build_hud() -> void:
	ui_layer = CanvasLayer.new()
	if arabic_font != null:
		var arabic_theme := Theme.new()
		arabic_theme.default_font = arabic_font
		# CanvasLayer has no Theme property; set the shared UI theme on the root Window.
		get_tree().root.theme = arabic_theme
	add_child(ui_layer)
	var title := Label.new()
	title.text = "لَمّة  |  عالم الأصدقاء"
	title.position = Vector2(24, 18)
	title.add_theme_font_size_override("font_size", 25)
	title.add_theme_color_override("font_color", Color("#e7fff7"))
	ui_layer.add_child(title)
	status_label = Label.new()
	status_label.text = "جاري الاتصال بعالم لَمّة..."
	status_label.position = Vector2(26, 54)
	status_label.add_theme_font_size_override("font_size", 14)
	status_label.add_theme_color_override("font_color", Color("#b9d8dc"))
	ui_layer.add_child(status_label)
	run_button = Button.new()
	run_button.text = "جري"
	run_button.custom_minimum_size = Vector2(90, 54)
	run_button.anchor_left = 1
	run_button.anchor_right = 1
	run_button.anchor_top = 1
	run_button.anchor_bottom = 1
	run_button.position = Vector2(-116, -178)
	run_button.pivot_offset = Vector2(45, 27)
	run_button.toggle_mode = true
	run_button.toggled.connect(func(enabled: bool): sprint_enabled = enabled)
	ui_layer.add_child(run_button)
	jump_button = Button.new()
	jump_button.text = "قفز"
	jump_button.custom_minimum_size = Vector2(90, 62)
	jump_button.anchor_left = 1
	jump_button.anchor_right = 1
	jump_button.anchor_top = 1
	jump_button.anchor_bottom = 1
	jump_button.position = Vector2(-116, -105)
	jump_button.pivot_offset = Vector2(45, 31)
	jump_button.pressed.connect(func(): jump_requested = true)
	ui_layer.add_child(jump_button)
	joystick_base = ColorRect.new()
	joystick_base.name = "TouchJoystickBase"
	joystick_base.color = Color(0.04, 0.08, 0.13, 0.48)
	joystick_base.size = Vector2(142, 142)
	joystick_base.position = Vector2(28, get_viewport().get_visible_rect().size.y - 174)
	joystick_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(joystick_base)
	joystick_knob = ColorRect.new()
	joystick_knob.name = "TouchJoystickKnob"
	joystick_knob.color = Color(0.45, 0.9, 0.78, 0.78)
	joystick_knob.size = Vector2(58, 58)
	joystick_knob.position = Vector2(42, 42)
	joystick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	joystick_base.add_child(joystick_knob)

	var settings_button := Button.new()
	settings_button.text = "إعدادات"
	settings_button.custom_minimum_size = Vector2(116, 46)
	settings_button.anchor_left = 1
	settings_button.anchor_right = 1
	settings_button.position = Vector2(-138, 18)
	settings_button.pressed.connect(_toggle_settings)
	ui_layer.add_child(settings_button)
	settings_panel = PanelContainer.new()
	settings_panel.name = "ControlSettings"
	settings_panel.anchor_left = 1
	settings_panel.anchor_right = 1
	settings_panel.position = Vector2(-292, 72)
	settings_panel.custom_minimum_size = Vector2(270, 150)
	settings_panel.visible = false
	ui_layer.add_child(settings_panel)
	var settings_content := VBoxContainer.new()
	settings_content.add_theme_constant_override("separation", 10)
	settings_panel.add_child(settings_content)
	var settings_title := Label.new()
	settings_title.text = "إعدادات التحكم"
	settings_title.add_theme_font_size_override("font_size", 17)
	settings_content.add_child(settings_title)
	var scale_label := Label.new()
	scale_label.text = "حجم أزرار الحركة والقفز"
	settings_content.add_child(scale_label)
	var scale_slider := HSlider.new()
	scale_slider.min_value = 0.7
	scale_slider.max_value = 1.4
	scale_slider.step = 0.05
	scale_slider.value = 1.0
	scale_slider.custom_minimum_size = Vector2(230, 30)
	scale_slider.value_changed.connect(_on_hud_scale_changed)
	settings_content.add_child(scale_slider)
	var close_settings := Button.new()
	close_settings.text = "إغلاق"
	close_settings.pressed.connect(func(): settings_panel.visible = false)
	settings_content.add_child(close_settings)

	portal_enter_button = Button.new()
	portal_enter_button.text = "دخول الغرفة"
	portal_enter_button.custom_minimum_size = Vector2(230, 56)
	portal_enter_button.anchor_left = 0.5
	portal_enter_button.anchor_right = 0.5
	portal_enter_button.position = Vector2(-115, 82)
	portal_enter_button.visible = false
	portal_enter_button.pressed.connect(_enter_nearby_portal)
	ui_layer.add_child(portal_enter_button)
	var hint := Label.new()
	hint.text = "حرّك العصا يسارًا · اسحب يمينًا لتحريك الكاميرا"
	hint.anchor_left = 0.5
	hint.anchor_right = 0.5
	hint.anchor_top = 1
	hint.anchor_bottom = 1
	hint.position = Vector2(-130, -36)
	hint.add_theme_font_size_override("font_size", 12)
	ui_layer.add_child(hint)

func _toggle_settings() -> void:
	if is_instance_valid(settings_panel):
		settings_panel.visible = not settings_panel.visible

func _on_hud_scale_changed(value: float) -> void:
	hud_scale = value
	if is_instance_valid(joystick_base):
		joystick_base.pivot_offset = Vector2(71, 71)
		joystick_base.scale = Vector2.ONE * hud_scale
	if is_instance_valid(run_button):
		run_button.scale = Vector2.ONE * hud_scale
	if is_instance_valid(jump_button):
		jump_button.scale = Vector2.ONE * hud_scale

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		camera_yaw -= event.relative.x * 0.006
		camera_pitch = clampf(camera_pitch + event.relative.y * 0.004, -0.65, 0.25)
	elif event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < get_viewport().size.x * 0.42:
				active_move = true
				move_origin = event.position
				move_touch = Vector2.ZERO
				_update_joystick_visual()
			elif event.position.x > get_viewport().size.x * 0.55:
				active_look = true
		else:
			if event.position.x < get_viewport().size.x * 0.48:
				active_move = false
				move_touch = Vector2.ZERO
				_update_joystick_visual()
			else:
				active_look = false
	elif event is InputEventScreenDrag:
		if active_move:
			move_touch = ((event.position - move_origin) / 65.0).limit_length(1.0)
			_update_joystick_visual()
		elif active_look:
			camera_yaw -= event.relative.x * 0.006
			camera_pitch = clampf(camera_pitch + event.relative.y * 0.004, -0.65, 0.25)

func _update_joystick_visual() -> void:
	if not is_instance_valid(joystick_knob):
		return
	var offset := move_touch * 38.0
	joystick_knob.position = Vector2(42, 42) + offset

func _process(delta: float) -> void:
	for wheel in attraction_wheels:
		wheel.rotation.z += delta * 0.22
	_update_camera(delta)
	_update_remote_players(delta)
	if firebase_uid != "" and is_instance_valid(player):
		firebase_send_clock += delta
		if firebase_send_clock >= 0.2:
			firebase_send_clock = 0.0
			firebase_bridge.send_position(player.global_position, player.rotation.y)
	if is_instance_valid(joystick_base):
		joystick_base.position.y = get_viewport().get_visible_rect().size.y - 174.0
	if not is_instance_valid(player):
		return
	var horizontal_speed := Vector2(player.velocity.x, player.velocity.z).length()
	if avatar_scene != null:
		_set_local_avatar_motion(horizontal_speed, player.is_on_floor())
	elif horizontal_speed > 0.25 and player.is_on_floor():
		animation_clock += delta * 9.0
		var swing := sin(animation_clock) * 0.42
		for i in range(animated_legs.size()):
			animated_legs[i].rotation.x = swing if i == 0 else -swing
		for i in range(animated_arms.size()):
			animated_arms[i].rotation.x = -swing if i == 0 else swing
	else:
		for limb in animated_legs:
			limb.rotation.x = move_toward(limb.rotation.x, 0.0, delta * 3.5)
		for limb in animated_arms:
			limb.rotation.x = move_toward(limb.rotation.x, 0.0, delta * 3.5)


func _on_firebase_connected(uid: String, player_name: String) -> void:
	firebase_uid = uid
	if is_instance_valid(local_name_tag):
		local_name_tag.text = player_name
	if is_instance_valid(status_label):
		status_label.text = "متصل أونلاين · جاري البحث عن اللاعبين..."

func _on_firebase_failed(reason: String) -> void:
	if is_instance_valid(status_label):
		status_label.text = "تعذر الاتصال: " + reason

func _on_firebase_players_changed(data: Dictionary) -> void:
	var seen: Dictionary = {}
	var now_ms := Time.get_unix_time_from_system() * 1000.0
	for room_id in data:
		var room = data[room_id]
		if typeof(room) != TYPE_DICTIONARY:
			continue
		var game = room.get("game", {})
		if typeof(game) != TYPE_DICTIONARY or game.get("type", "") != "lamma_hub":
			continue
		var players = room.get("players", {})
		if typeof(players) != TYPE_DICTIONARY:
			continue
		for uid in players:
			if str(uid) == firebase_uid:
				continue
			var entry = players[uid]
			if typeof(entry) != TYPE_DICTIONARY:
				continue
			if now_ms - float(entry.get("updatedAt", 0)) > 12000.0:
				continue
			var pos = entry.get("position", {})
			if typeof(pos) != TYPE_DICTIONARY:
				continue
			seen[str(uid)] = true
			if not remote_avatars.has(str(uid)):
				_create_remote_avatar(str(uid), str(entry.get("name", "لاعب")))
			remote_targets[str(uid)] = Vector3(
				float(pos.get("x", 0.0)),
				float(pos.get("y", 0.0)),
				float(pos.get("z", 0.0))
			)
			remote_yaws[str(uid)] = float(entry.get("yaw", 0.0))
	for uid in remote_avatars.keys():
		if not seen.has(uid):
			remote_avatars[uid].queue_free()
			remote_avatars.erase(uid)
			remote_targets.erase(uid)
			remote_yaws.erase(uid)
	if is_instance_valid(status_label) and firebase_uid != "":
		status_label.text = "متصل أونلاين · " + str(remote_avatars.size() + 1) + " لاعب"

func _create_remote_avatar(uid: String, player_name: String) -> void:
	var remote := Node3D.new()
	remote.name = "RemotePlayer_" + uid
	add_child(remote)
	var collider_body := StaticBody3D.new()
	collider_body.name = "PlayerCollision"
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.8
	collision.shape = capsule
	collision.position.y = 0.9
	collider_body.add_child(collision)
	remote.add_child(collider_body)
	if avatar_scene != null:
		_apply_professional_avatar(remote)
	else:
		_build_girl_model(remote, false)
	var name_tag := Label3D.new()
	name_tag.name = "PlayerName"
	name_tag.text = player_name
	if arabic_font != null:
		name_tag.font = arabic_font
	name_tag.position = Vector3(0, 2.08, 0)
	name_tag.font_size = 30
	name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	name_tag.modulate = Color("#e7fff7")
	remote.add_child(name_tag)
	remote_avatars[uid] = remote

func _update_remote_players(delta: float) -> void:
	for uid in remote_avatars:
		var remote: Node3D = remote_avatars[uid]
		if remote_targets.has(uid):
			remote.global_position = remote.global_position.lerp(remote_targets[uid], minf(1.0, delta * 8.0))
			remote.rotation.y = lerp_angle(remote.rotation.y, float(remote_yaws.get(uid, 0.0)), delta * 8.0)

func _camera_relative_direction(input_dir: Vector2) -> Vector3:
	var forward := Vector3(-sin(camera_yaw), 0, -cos(camera_yaw))
	var right := Vector3(-forward.z, 0, forward.x)
	return (right * input_dir.x - forward * input_dir.y).normalized()

func _yaw_for_direction(direction: Vector3) -> float:
	return atan2(direction.x, -direction.z)

func _physics_process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	var input_dir := move_touch if active_move else Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	)
	if input_dir.length() > 1.0:
		input_dir = input_dir.normalized()
	# Camera-relative movement: joystick up always follows the camera's forward axis.
	var direction := _camera_relative_direction(input_dir)
	var has_input := direction.length() > 0.05
	var max_speed := MOVE_SPEED * (1.65 if sprint_enabled else 1.0)
	var desired_velocity := direction * max_speed if has_input else Vector3.ZERO
	# Acceleration and braking make starts/stops feel like a person moving, not a sliding rigid object.
	var rate := 13.0 if has_input else 19.0
	player.velocity.x = move_toward(player.velocity.x, desired_velocity.x, rate * delta)
	player.velocity.z = move_toward(player.velocity.z, desired_velocity.z, rate * delta)
	var actual_horizontal_speed := Vector2(player.velocity.x, player.velocity.z).length()
	if actual_horizontal_speed > 0.18:
		# Turn toward the real travel direction smoothly; no instant snapping on direction changes.
		var travel_direction := Vector3(player.velocity.x, 0.0, player.velocity.z).normalized()
		var target_yaw := _yaw_for_direction(travel_direction)
		var turn_weight := 1.0 - exp(-10.0 * delta)
		player.rotation.y = lerp_angle(player.rotation.y, target_yaw, turn_weight)
	if not player.is_on_floor():
		player.velocity.y -= 18.0 * delta
	elif jump_requested or Input.is_action_just_pressed("ui_accept"):
		player.velocity.y = JUMP_VELOCITY
	jump_requested = false
	player.move_and_slide()
