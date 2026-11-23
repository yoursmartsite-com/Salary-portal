extends Node3D

const FirebaseHub = preload("res://scripts/firebase_hub.gd")
const MOVE_SPEED := 5.2
const JUMP_VELOCITY := 5.8
var player: CharacterBody3D
var camera: Camera3D
var camera_yaw := 0.0
var camera_pitch := -0.14
var camera_distance := 1.95
var free_look_button: Button
var active_look := false
var active_move := false
var move_origin := Vector2.ZERO
var move_touch := Vector2.ZERO
var move_touch_index := -1
var look_touch_index := -1
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
var settings_button: Button
var hud_scale_slider: HSlider
var hud_scale := 1.0
var layout_edit_mode := false
var dragging_control: Control
var drag_offset := Vector2.ZERO
var quality_option: OptionButton
var local_name_tag: Label3D
var avatar_scene: PackedScene
var avatar_animation_state := "idle"
var firebase_bridge
var arabic_font: Font
var firebase_uid := ""
var firebase_send_clock := 0.0
var remote_avatars: Dictionary = {}
var remote_targets: Dictionary = {}
var remote_yaws: Dictionary = {}
var portal_enter_button: Button
var nearby_portal_url := ""
var nearby_portal_label := ""
var joystick_base: Panel
var joystick_knob: Panel
var camera_look_zone: Control

func _ready() -> void:
	_build_environment()
	_build_player()
	_build_camera()
	arabic_font = load("res://assets/Cairo.ttf") as Font if ResourceLoader.exists("res://assets/Cairo.ttf") else null
	_build_hud()
	_load_control_layout()
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
	_make_world_architecture()
	_make_lamma_landmarks()

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
	_make_box("Cafe building", pos + Vector3(0, 1.7, 0), Vector3(7, 3.4, 5), Color("#263747"))
	_make_box("Cafe roof", pos + Vector3(0, 3.55, 0), Vector3(7.6, 0.35, 5.6), Color("#176b60"), 0.34)
	_make_box("Cafe fascia", pos + Vector3(0, 3.12, -2.58), Vector3(7.25, 0.32, 0.16), Color("#d6b77c"), 0.4)
	_make_box("Cafe panoramic glass", pos + Vector3(0, 1.95, -2.56), Vector3(5.45, 1.72, 0.07), Color("#173b50"), 0.16)
	for x in [-1.82, 0.0, 1.82]:
		_make_box("Cafe window mullion", pos + Vector3(x, 1.95, -2.62), Vector3(0.055, 1.72, 0.06), Color("#b9d7d3"), 0.3)
	_make_box("Cafe counter", pos + Vector3(0, 1.02, -2.9), Vector3(5.6, 0.16, 0.65), Color("#9a7655"), 0.48)
	_make_box("Cafe awning", pos + Vector3(0, 2.95, -3.08), Vector3(6.2, 0.12, 1.05), Color("#d8eee4"), 0.55)
	for i in range(9):
		_make_box("Cafe awning stripe", pos + Vector3(-2.75 + float(i) * 0.69, 2.88, -3.1), Vector3(0.32, 0.035, 1.0), Color("#267b70"), 0.6)
	for side in [-1.0, 1.0]:
		_make_box("Cafe side window", pos + Vector3(side * 3.53, 1.95, -0.35), Vector3(0.06, 1.45, 2.0), Color("#174056"), 0.18)
		_make_box("Cafe wall sconce", pos + Vector3(side * 2.7, 2.35, -2.7), Vector3(0.18, 0.32, 0.12), Color("#f5cb83"), 0.25)
	_make_box("Cafe entrance", pos + Vector3(2.82, 1.1, -2.58), Vector3(0.72, 2.2, 0.1), Color("#604c3d"), 0.35)
	_make_box("Cafe door glass", pos + Vector3(2.82, 1.22, -2.65), Vector3(0.48, 1.72, 0.035), Color("#4c8790"), 0.16)
	_make_box("Cafe sign panel", pos + Vector3(0, 3.92, -2.85), Vector3(3.3, 0.48, 0.18), Color("#102b35"), 0.38)
	var cafe_label := Label3D.new()
	cafe_label.text = "LAMMA CAFE"
	cafe_label.position = pos + Vector3(0, 3.82, -2.72)
	cafe_label.font_size = 25
	cafe_label.pixel_size = 0.012
	cafe_label.modulate = Color("#f4d49a")
	add_child(cafe_label)

func _detail_box(label: String, pos: Vector3, size: Vector3, color: Color, roughness := 0.78, metallic := 0.0) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.position = pos
	node.material_override = _make_material(color, roughness, metallic)
	add_child(node)
	return node

func _make_bench(pos: Vector3, facing := 0.0) -> void:
	var bench := Node3D.new()
	bench.position = pos
	bench.rotation.y = facing
	add_child(bench)
	var wood := _make_material(Color("#8b6042"), 0.62)
	var metal := _make_material(Color("#263b49"), 0.32, 0.72)
	for i in range(5):
		var plank := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(1.85, 0.075, 0.16)
		plank.mesh = pm
		plank.position = Vector3(0, 0.58, -0.32 + float(i) * 0.16)
		plank.material_override = wood
		bench.add_child(plank)
	var seat := MeshInstance3D.new()
	var seat_mesh := BoxMesh.new()
	seat_mesh.size = Vector3(1.95, 0.12, 0.58)
	seat.mesh = seat_mesh
	seat.position = Vector3(0, 0.42, 0)
	seat.material_override = wood
	bench.add_child(seat)
	for side in [-1.0, 1.0]:
		var leg := MeshInstance3D.new()
		var lm := BoxMesh.new()
		lm.size = Vector3(0.12, 0.72, 0.62)
		leg.mesh = lm
		leg.position = Vector3(side * 0.72, 0.2, 0)
		leg.material_override = metal
		bench.add_child(leg)

func _make_world_architecture() -> void:
	# Fine paving bands give the promenade a readable, constructed surface.
	for z in range(-16, 18, 2):
		_detail_box("Promenade paving joint", Vector3(0, 0.087, float(z)), Vector3(11.6, 0.012, 0.035), Color("#69747b"), 0.92)
	for x in [-4.0, -2.0, 0.0, 2.0, 4.0]:
		_detail_box("Promenade paving joint", Vector3(x, 0.087, 0), Vector3(0.025, 0.012, 32.0), Color("#68747b"), 0.92)
	# Low perimeter rails and warm metal caps around the beach edge.
	for side in [-1.0, 1.0]:
		_detail_box("Beach promenade rail", Vector3(side * 12.0, 0.72, 20.0), Vector3(0.12, 1.25, 10.0), Color("#263d4b"), 0.36, 0.65)
		for z in range(16, 25, 2):
			_detail_box("Beach rail post", Vector3(side * 12.0, 0.88, float(z)), Vector3(0.22, 1.7, 0.22), Color("#b28b58"), 0.34, 0.55)
		_detail_box("Beach rail top", Vector3(side * 12.0, 1.72, 20.0), Vector3(0.25, 0.12, 10.0), Color("#c4a16b"), 0.3, 0.55)
	# Seating pockets, planters and subtle path markers.
	for z in [-13.0, -5.0, 3.0, 11.0]:
		_make_bench(Vector3(-10.0, 0.0, z), PI * 0.5)
		_make_bench(Vector3(10.0, 0.0, z), -PI * 0.5)
	for x in [-18.0, 18.0]:
		for z in [-17.0, -7.0, 3.0, 13.0]:
			_detail_box("Garden curb", Vector3(x, 0.2, z), Vector3(2.8, 0.38, 2.8), Color("#354d49"), 0.84)
			_detail_box("Garden soil", Vector3(x, 0.405, z), Vector3(2.5, 0.06, 2.5), Color("#33291f"), 0.98)
			for n in range(5):
				var plant := MeshInstance3D.new()
				var leaf_mesh := SphereMesh.new()
				leaf_mesh.radius = 0.34
				leaf_mesh.height = 0.95
				plant.mesh = leaf_mesh
				plant.position = Vector3(x + (float(n % 3) - 1.0) * 0.65, 0.88 + float(n % 2) * 0.12, z + (float(n / 3) - 0.5) * 0.8)
				plant.material_override = _make_material(Color("#236044") if n % 2 == 0 else Color("#397b50"), 0.94)
				add_child(plant)
	# Small beach rocks add a natural transition between sand and water.
	for i in range(18):
		var rock := MeshInstance3D.new()
		var rock_mesh := SphereMesh.new()
		rock_mesh.radius = 0.5
		rock_mesh.height = 0.65
		rock.mesh = rock_mesh
		rock.position = Vector3(-28.0 + float(i) * 3.25, 0.02, 28.5 + sin(float(i) * 1.7) * 1.2)
		rock.scale = Vector3(1.4, 0.55, 0.9)
		rock.material_override = _make_material(Color("#687477") if i % 2 == 0 else Color("#8b897b"), 0.94)
		add_child(rock)

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
			if wanted == "walk" and lowered.contains("walk"):
				chosen = animation_name
				break
			if wanted == "jump" and (lowered.contains("jump") or lowered.contains("fall")):
				chosen = animation_name
				break
			if wanted == "idle" and (lowered.contains("idle") or lowered.contains("stand")):
				chosen = animation_name
				break
		# Prefer a real run cycle when running; use the walk cycle only as a fallback.
		if chosen == "" and wanted == "run":
			for animation_name in anim_player.get_animation_list():
				var lowered := animation_name.to_lower()
				if lowered.contains("walk"):
					chosen = animation_name
					break
		if wanted == "idle" and chosen == "":
			# This rig has no authored idle clip. Stop playback first, then clear every
			# procedural bone override so the character returns to its neutral bind pose.
			anim_player.clear_queue()
			anim_player.stop()
			anim_player.speed_scale = 1.0
			for skeleton_node in model.find_children("*", "Skeleton3D", true, false):
				var skeleton := skeleton_node as Skeleton3D
				skeleton.reset_bone_poses()
				skeleton.force_update_all_bone_transforms()
			continue
		if chosen != "":
			var clip := anim_player.get_animation(chosen)
			# Imported glTF clips may default to one-shot playback. A walk/run cycle
			# must loop or it freezes on its final (often one-legged) stride.
			if wanted == "walk" or wanted == "run":
				clip.loop_mode = Animation.LOOP_LINEAR
			elif wanted == "jump":
				clip.loop_mode = Animation.LOOP_NONE
			if anim_player.current_animation != chosen or not anim_player.is_playing():
				anim_player.play(chosen, 0.18)

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
		elif wanted == "walk" or wanted == "run":
			# Some imported GLB players can stop at a clip boundary even after the
			# resource loop flag is changed at runtime. Restart only if playback stopped;
			# never restart a healthy cycle, or the gait would jump back to frame zero.
			var locomotion_running := false
			for item in model.find_children("*", "AnimationPlayer", true, false):
				var ap := item as AnimationPlayer
				if ap.is_playing():
					locomotion_running = true
			if not locomotion_running:
				_play_avatar_animation(model, wanted)
		_set_avatar_animation_speed(model, speed, wanted)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FollowCamera"
	camera.current = true
	# PUBG-like close over-the-shoulder framing: keep the avatar large and readable.
	camera.fov = 60
	add_child(camera)
	_update_camera()

func _update_camera(delta := 1.0) -> void:
	if not is_instance_valid(player):
		return
	var target := player.global_position + Vector3(0, 1.52, 0)
	# Orbit smoothly around the avatar, with a modest shoulder offset and tighter follow distance.
	var shoulder := Vector3(cos(camera_yaw) * 0.34, 0.0, -sin(camera_yaw) * 0.34)
	var behind := Vector3(sin(camera_yaw) * camera_distance, 1.42 - camera_pitch * 0.55, cos(camera_yaw) * camera_distance)
	var desired_position := target + behind + shoulder
	camera.global_position = camera.global_position.lerp(desired_position, 1.0 - exp(-14.0 * delta))
	camera.look_at(target, Vector3.UP)

func _build_hud() -> void:
	# The HUD is authored as a real Godot scene so controls are visible in the editor
	# and are packaged with the world instead of being assembled invisibly at runtime.
	ui_layer = preload("res://scenes/hud.tscn").instantiate() as CanvasLayer
	add_child(ui_layer)
	var hud_root := ui_layer.get_node("Root") as Control
	if arabic_font != null:
		var arabic_theme := Theme.new()
		arabic_theme.default_font = arabic_font
		get_tree().root.theme = arabic_theme

	status_label = hud_root.get_node("Status") as Label
	run_button = hud_root.get_node("RunButton") as Button
	jump_button = hud_root.get_node("JumpButton") as Button
	joystick_base = hud_root.get_node("JoystickBase") as Panel
	joystick_knob = hud_root.get_node("JoystickBase/JoystickKnob") as Panel
	settings_button = hud_root.get_node("SettingsButton") as Button
	free_look_button = hud_root.get_node("FreeLookButton") as Button
	camera_look_zone = hud_root.get_node("CameraLookZone") as Control
	settings_panel = hud_root.get_node("SettingsPanel") as PanelContainer
	hud_scale_slider = hud_root.get_node("SettingsPanel/SettingsContent/HudScaleSlider") as HSlider
	quality_option = hud_root.get_node("SettingsPanel/SettingsContent/QualityOption") as OptionButton
	portal_enter_button = hud_root.get_node("PortalEnterButton") as Button

	for button in [run_button, jump_button, settings_button, free_look_button, portal_enter_button]:
		_style_hud_button(button)
	_style_action_button(run_button)
	_style_action_button(jump_button)
	run_button.toggled.connect(func(enabled: bool): sprint_enabled = enabled)
	jump_button.pressed.connect(func(): jump_requested = true)
	settings_button.pressed.connect(_toggle_settings)
	free_look_button.pressed.connect(_recenter_camera)
	hud_scale_slider.value_changed.connect(_on_hud_scale_changed)
	quality_option.item_selected.connect(_set_graphics_quality)
	var layout_button := hud_root.get_node("SettingsPanel/SettingsContent/LayoutButton") as Button
	layout_button.toggled.connect(_set_layout_edit_mode)
	var close_settings := hud_root.get_node("SettingsPanel/SettingsContent/CloseSettings") as Button
	close_settings.pressed.connect(func(): settings_panel.visible = false)
	portal_enter_button.pressed.connect(_enter_nearby_portal)
	_set_graphics_quality(1)

func _style_hud_button(button: Button) -> void:
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 17)
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.035, 0.105, 0.16, 0.94)
	normal.border_color = Color(0.28, 0.72, 0.68, 0.95)
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(13)
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 7
	normal.content_margin_bottom = 7
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = Color(0.07, 0.22, 0.27, 0.98)
	var pressed := normal.duplicate() as StyleBoxFlat
	pressed.bg_color = Color(0.12, 0.38, 0.36, 1.0)
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_color_override("font_color", Color("#edfff9"))
	button.add_theme_color_override("font_hover_color", Color.WHITE)
	button.add_theme_color_override("font_pressed_color", Color.WHITE)

func _style_action_button(button: Button) -> void:
	# Circular, high-contrast action controls inspired by mobile battle-royale HUDs.
	button.custom_minimum_size = Vector2(84, 84)
	button.add_theme_color_override("icon_normal_color", Color.WHITE)
	button.add_theme_color_override("icon_hover_color", Color.WHITE)
	button.add_theme_color_override("icon_pressed_color", Color.WHITE)
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.025, 0.045, 0.065, 0.78)
	normal.border_color = Color(0.88, 0.96, 1.0, 0.82)
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(44)
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = Color(0.12, 0.22, 0.28, 0.92)
	var pressed := normal.duplicate() as StyleBoxFlat
	pressed.bg_color = Color(0.12, 0.42, 0.39, 0.98)
	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("focus", normal)

func _set_graphics_quality(index: int) -> void:
	var viewport := get_viewport()
	var world_env := get_node_or_null("WorldEnvironment") as WorldEnvironment
	if world_env != null and world_env.environment != null:
		var env := world_env.environment
		env.glow_enabled = index == 2
		env.fog_enabled = index > 0
		for light in get_children():
			if light is DirectionalLight3D:
				light.shadow_enabled = index > 0
	if index == 0:
		viewport.scaling_3d_scale = 0.75
		viewport.msaa_3d = Viewport.MSAA_DISABLED
	elif index == 1:
		viewport.scaling_3d_scale = 0.9
		viewport.msaa_3d = Viewport.MSAA_2X
	else:
		viewport.scaling_3d_scale = 1.0
		viewport.msaa_3d = Viewport.MSAA_2X

func _set_layout_edit_mode(enabled: bool) -> void:
	layout_edit_mode = enabled
	if not enabled:
		_save_control_layout()
	if is_instance_valid(status_label):
		status_label.text = "اسحب العصا وأزرار القفز والجري لتغيير أماكنها" if enabled else "تم حفظ أماكن التحكم"
	if is_instance_valid(joystick_base):
		var joystick_style := StyleBoxFlat.new()
		joystick_style.bg_color = Color(0.9, 0.65, 0.18, 0.82) if enabled else Color(0.04, 0.08, 0.13, 0.58)
		joystick_style.corner_radius_top_left = 64
		joystick_style.corner_radius_top_right = 64
		joystick_style.corner_radius_bottom_left = 64
		joystick_style.corner_radius_bottom_right = 64
		joystick_style.border_color = Color(0.45, 0.82, 0.78, 0.9)
		joystick_style.set_border_width_all(2)
		joystick_base.add_theme_stylebox_override("panel", joystick_style)

func _recenter_camera() -> void:
	if not is_instance_valid(player):
		return
	camera_yaw = player.rotation.y
	camera_pitch = -0.14

func _toggle_settings() -> void:
	if is_instance_valid(settings_panel):
		settings_panel.visible = not settings_panel.visible

func _on_hud_scale_changed(value: float) -> void:
	hud_scale = value
	for control in [joystick_base, run_button, jump_button]:
		if is_instance_valid(control):
			control.pivot_offset = control.size * 0.5
			control.scale = Vector2.ONE * hud_scale
	_save_control_layout()

func _load_control_layout() -> void:
	var config := ConfigFile.new()
	if config.load("user://lamma_hub_controls.cfg") != OK:
		return
	hud_scale = float(config.get_value("controls", "scale", 1.0))
	# Migrate existing saved layouts once so the previous left-side joystick does not override the mirrored HUD.
	if int(config.get_value("controls", "layout_version", 0)) < 3:
		config.set_value("controls", "layout_version", 3)
		config.set_value("controls", "joystick", joystick_base.position)
		config.set_value("controls", "run", run_button.position)
		config.set_value("controls", "jump", jump_button.position)
		config.save("user://lamma_hub_controls.cfg")
	if is_instance_valid(hud_scale_slider):
		hud_scale_slider.set_value_no_signal(hud_scale)
	for entry in [["joystick", joystick_base], ["run", run_button], ["jump", jump_button]]:
		var control: Control = entry[1]
		if is_instance_valid(control) and config.has_section_key("controls", entry[0]):
			control.position = config.get_value("controls", entry[0], control.position)
			control.pivot_offset = control.size * 0.5
			control.scale = Vector2.ONE * hud_scale

func _save_control_layout() -> void:
	var config := ConfigFile.new()
	config.load("user://lamma_hub_controls.cfg")
	config.set_value("controls", "scale", hud_scale)
	# Mark newly saved layouts as migrated so loading them never resets edited positions.
	config.set_value("controls", "layout_version", 3)
	for entry in [["joystick", joystick_base], ["run", run_button], ["jump", jump_button]]:
		var control: Control = entry[1]
		if is_instance_valid(control):
			config.set_value("controls", entry[0], control.position)
	config.save("user://lamma_hub_controls.cfg")

func _point_over_control(point: Vector2) -> bool:
	for control in [run_button, jump_button, free_look_button, settings_button, settings_panel, portal_enter_button]:
		if is_instance_valid(control) and control.is_visible_in_tree() and control.get_global_rect().has_point(point):
			return true
	return false

func _input(event: InputEvent) -> void:
	if layout_edit_mode:
		if event is InputEventScreenTouch:
			if event.pressed:
				for control in [joystick_base, run_button, jump_button]:
					if is_instance_valid(control) and control.get_global_rect().has_point(event.position):
						dragging_control = control
						drag_offset = event.position - control.global_position
						get_viewport().set_input_as_handled()
						return
			else:
				if is_instance_valid(dragging_control):
					_save_control_layout()
				dragging_control = null
				get_viewport().set_input_as_handled()
				return
		if event is InputEventScreenDrag and is_instance_valid(dragging_control):
			var viewport_size := get_viewport().get_visible_rect().size
			var control_size := dragging_control.size * dragging_control.scale
			var next_position: Vector2 = event.position - drag_offset
			next_position.x = clampf(next_position.x, 8.0, viewport_size.x - control_size.x - 8.0)
			next_position.y = clampf(next_position.y, 8.0, viewport_size.y - control_size.y - 8.0)
			dragging_control.global_position = next_position
			get_viewport().set_input_as_handled()
			return

	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		camera_yaw -= event.relative.x * 0.006
		camera_pitch = clampf(camera_pitch + event.relative.y * 0.004, -0.65, 0.25)
	elif event is InputEventScreenTouch:
		if event.pressed:
			var viewport_size := get_viewport().get_visible_rect().size
			var on_joystick := is_instance_valid(joystick_base) and joystick_base.get_global_rect().has_point(event.position)
			if on_joystick and move_touch_index == -1:
				active_move = true
				move_touch_index = event.index
				move_origin = joystick_base.global_position + joystick_base.size * 0.5
				move_touch = ((event.position - move_origin) / 55.0).limit_length(1.0)
				_update_joystick_visual()
			elif is_instance_valid(camera_look_zone) and camera_look_zone.get_global_rect().has_point(event.position) and not _point_over_control(event.position) and look_touch_index == -1:
				active_look = true
				look_touch_index = event.index
		else:
			if event.index == move_touch_index:
				active_move = false
				move_touch_index = -1
				move_touch = Vector2.ZERO
				_update_joystick_visual()
			if event.index == look_touch_index:
				active_look = false
				look_touch_index = -1
	elif event is InputEventScreenDrag:
		if active_move and event.index == move_touch_index:
			move_touch = ((event.position - move_origin) / 55.0).limit_length(1.0)
			_update_joystick_visual()
		elif active_look and event.index == look_touch_index:
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
		if not remote_targets.has(uid):
			continue
		remote.global_position = remote.global_position.lerp(remote_targets[uid], minf(1.0, delta * 8.0))
		remote.rotation.y = lerp_angle(remote.rotation.y, float(remote_yaws.get(uid, 0.0)), delta * 8.0)

func _camera_relative_direction(input_dir: Vector2) -> Vector3:
	var forward := Vector3(-sin(camera_yaw), 0, -cos(camera_yaw))
	var right := Vector3(-forward.z, 0, forward.x)
	return (right * input_dir.x - forward * input_dir.y).normalized()

func _yaw_for_direction(direction: Vector3) -> float:
	# Godot's local forward axis is -Z; positive Y rotation turns it toward -X.
	# Negating X keeps left/right facing aligned with the actual travel direction.
	return atan2(-direction.x, -direction.z)

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


# Distinctive Lamma landmarks: a social plaza, arcade pavilion and beach leisure area.
# Built from real 3D meshes so the scene remains editable and exportable in Godot.
func _make_lamma_landmarks() -> void:
	_make_fountain(Vector3(0, 0.0, 15.0))
	_make_arcade_pavilion(Vector3(25.0, 0.0, -13.0))
	_make_beach_lounges()
	_make_lighthouse(Vector3(29.0, 0.0, 26.0))
	_make_welcome_arch(Vector3(0.0, 0.0, -25.0))

func _make_fountain(pos: Vector3) -> void:
	var stone := _make_material(Color("#b8c2c4"), 0.32, 0.18)
	var dark_stone := _make_material(Color("#344b58"), 0.3, 0.28)
	var water_mat := _make_material(Color("#36b9c3"), 0.16, 0.35)
	var base := MeshInstance3D.new()
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = 3.2
	base_mesh.bottom_radius = 3.55
	base_mesh.height = 0.48
	base.mesh = base_mesh
	base.position = pos + Vector3(0, 0.24, 0)
	base.material_override = dark_stone
	add_child(base)
	var basin := MeshInstance3D.new()
	var basin_mesh := CylinderMesh.new()
	basin_mesh.top_radius = 2.95
	basin_mesh.bottom_radius = 3.1
	basin_mesh.height = 0.22
	basin.mesh = basin_mesh
	basin.position = pos + Vector3(0, 0.56, 0)
	basin.material_override = stone
	add_child(basin)
	var water := MeshInstance3D.new()
	var water_mesh := CylinderMesh.new()
	water_mesh.top_radius = 2.72
	water_mesh.bottom_radius = 2.72
	water_mesh.height = 0.055
	water.mesh = water_mesh
	water.position = pos + Vector3(0, 0.69, 0)
	water.material_override = water_mat
	add_child(water)
	for i in range(8):
		var angle := TAU * float(i) / 8.0
		var jet := MeshInstance3D.new()
		var jet_mesh := CylinderMesh.new()
		jet_mesh.top_radius = 0.035
		jet_mesh.bottom_radius = 0.075
		jet_mesh.height = 1.1
		jet.mesh = jet_mesh
		jet.position = pos + Vector3(cos(angle) * 1.75, 1.15, sin(angle) * 1.75)
		jet.material_override = water_mat
		add_child(jet)
	var center := MeshInstance3D.new()
	var center_mesh := SphereMesh.new()
	center_mesh.radius = 0.52
	center_mesh.height = 1.05
	center.mesh = center_mesh
	center.position = pos + Vector3(0, 1.1, 0)
	center.material_override = _make_material(Color("#8be5dc"), 0.18, 0.45)
	add_child(center)
	var glow := OmniLight3D.new()
	glow.position = pos + Vector3(0, 1.2, 0)
	glow.light_color = Color("#4edbd1")
	glow.light_energy = 0.65
	glow.omni_range = 7.0
	add_child(glow)

func _make_arcade_pavilion(pos: Vector3) -> void:
	var shell := _make_material(Color("#172b42"), 0.42, 0.18)
	var trim := _make_material(Color("#e0b66d"), 0.3, 0.55)
	var glass := _make_material(Color("#28647a"), 0.16, 0.28)
	_detail_box("Arcade pavilion foundation", pos + Vector3(0, 0.22, 0), Vector3(12.0, 0.44, 9.0), Color("#344958"), 0.42, 0.2)
	_detail_box("Arcade pavilion body", pos + Vector3(0, 2.45, 0), Vector3(11.2, 4.2, 8.2), Color("#1b3047"), 0.5, 0.12)
	_detail_box("Arcade pavilion roof", pos + Vector3(0, 4.72, 0), Vector3(12.0, 0.38, 9.0), Color("#d6ad68"), 0.32, 0.45)
	_detail_box("Arcade pavilion front glass", pos + Vector3(0, 2.45, -4.13), Vector3(8.8, 2.7, 0.12), Color("#28647a"), 0.16, 0.28)
	for x in [-4.45, -2.2, 0.0, 2.2, 4.45]:
		_detail_box("Arcade pavilion mullion", pos + Vector3(x, 2.45, -4.22), Vector3(0.11, 2.9, 0.16), Color("#d8c69f"), 0.28, 0.42)
	for x in [-5.45, 5.45]:
		_detail_box("Arcade pavilion corner", pos + Vector3(x, 2.35, -4.22), Vector3(0.32, 4.2, 0.36), Color("#54bcb1"), 0.3, 0.3)
	_detail_box("Arcade marquee", pos + Vector3(0, 4.0, -4.42), Vector3(6.6, 0.72, 0.28), Color("#102335"), 0.28, 0.3)
	var marquee_text := Label3D.new()
	marquee_text.text = "LAMMA  •  ARCADE"
	if arabic_font != null:
		marquee_text.font = arabic_font
	marquee_text.position = pos + Vector3(0, 3.91, -4.25)
	marquee_text.font_size = 34
	marquee_text.pixel_size = 0.012
	marquee_text.modulate = Color("#a5fff0")
	add_child(marquee_text)
	for x in [-3.8, -1.3, 1.3, 3.8]:
		var strip := MeshInstance3D.new()
		var strip_mesh := BoxMesh.new()
		strip_mesh.size = Vector3(0.72, 0.08, 0.12)
		strip.mesh = strip_mesh
		strip.position = pos + Vector3(x, 4.9, -4.48)
		strip.material_override = trim
		add_child(strip)
	var sign_light := OmniLight3D.new()
	sign_light.position = pos + Vector3(0, 4.0, -5.2)
	sign_light.light_color = Color("#54d9d0")
	sign_light.light_energy = 1.1
	sign_light.omni_range = 10.0
	add_child(sign_light)

func _make_beach_lounges() -> void:
	for i in range(3):
		var x := -19.0 + float(i) * 9.0
		var z := 23.0 + float(i % 2) * 2.0
		var umbrella := Node3D.new()
		umbrella.position = Vector3(x, 0.0, z)
		add_child(umbrella)
		var pole := MeshInstance3D.new()
		var pole_mesh := CylinderMesh.new()
		pole_mesh.top_radius = 0.045
		pole_mesh.bottom_radius = 0.07
		pole_mesh.height = 2.55
		pole.mesh = pole_mesh
		pole.position.y = 1.28
		pole.material_override = _make_material(Color("#e8dfc8"), 0.42, 0.15)
		umbrella.add_child(pole)
		var canopy := MeshInstance3D.new()
		var canopy_mesh := CylinderMesh.new()
		canopy_mesh.top_radius = 0.08
		canopy_mesh.bottom_radius = 1.65
		canopy_mesh.height = 0.42
		canopy.mesh = canopy_mesh
		canopy.position.y = 2.42
		var umbrella_colors := [Color("#e97878"), Color("#54b9ad"), Color("#e7bd70")]
		canopy.material_override = _make_material(umbrella_colors[i], 0.48)
		umbrella.add_child(canopy)
		var bed := MeshInstance3D.new()
		var bed_mesh := BoxMesh.new()
		bed_mesh.size = Vector3(1.15, 0.18, 2.15)
		bed.mesh = bed_mesh
		bed.position = Vector3(x + 1.25, 0.28, z + 1.0)
		bed.material_override = _make_material(Color("#d8d4c6"), 0.7)
		add_child(bed)
		var back := MeshInstance3D.new()
		var back_mesh := BoxMesh.new()
		back_mesh.size = Vector3(1.15, 0.82, 0.16)
		back.mesh = back_mesh
		back.position = Vector3(x + 1.25, 0.68, z + 1.92)
		back.rotation.x = deg_to_rad(-18)
		back.material_override = _make_material(Color("#f0e7d8"), 0.72)
		add_child(back)

func _make_lighthouse(pos: Vector3) -> void:
	var tower := MeshInstance3D.new()
	var tower_mesh := CylinderMesh.new()
	tower_mesh.top_radius = 0.85
	tower_mesh.bottom_radius = 1.35
	tower_mesh.height = 8.0
	tower.mesh = tower_mesh
	tower.position = pos + Vector3(0, 4.0, 0)
	tower.material_override = _make_material(Color("#e6e0d2"), 0.82)
	add_child(tower)
	for y in [1.4, 3.6, 5.8]:
		var band := MeshInstance3D.new()
		var band_mesh := CylinderMesh.new()
		band_mesh.top_radius = 1.08
		band_mesh.bottom_radius = 1.18
		band_mesh.height = 0.62
		band.mesh = band_mesh
		band.position = pos + Vector3(0, y, 0)
		band.material_override = _make_material(Color("#bd665c"), 0.78)
		add_child(band)
	var lantern := MeshInstance3D.new()
	var lantern_mesh := CylinderMesh.new()
	lantern_mesh.top_radius = 1.05
	lantern_mesh.bottom_radius = 1.05
	lantern_mesh.height = 1.1
	lantern.mesh = lantern_mesh
	lantern.position = pos + Vector3(0, 8.55, 0)
	lantern.material_override = _make_material(Color("#3b6875"), 0.18, 0.4)
	add_child(lantern)
	var roof := MeshInstance3D.new()
	var roof_mesh := PrismMesh.new()
	roof_mesh.size = Vector3(2.5, 1.15, 2.5)
	roof.mesh = roof_mesh
	roof.position = pos + Vector3(0, 9.65, 0)
	roof.material_override = _make_material(Color("#263c4a"), 0.35, 0.5)
	add_child(roof)
	var beacon := OmniLight3D.new()
	beacon.position = pos + Vector3(0, 8.6, 0)
	beacon.light_color = Color("#9cf6ee")
	beacon.light_energy = 2.0
	beacon.omni_range = 22.0
	add_child(beacon)

func _make_welcome_arch(pos: Vector3) -> void:
	var arch := Node3D.new()
	arch.position = pos
	add_child(arch)
	var frame_mat := _make_material(Color("#d2b078"), 0.3, 0.62)
	for side in [-1.0, 1.0]:
		var pillar := MeshInstance3D.new()
		var pillar_mesh := BoxMesh.new()
		pillar_mesh.size = Vector3(0.48, 5.4, 0.62)
		pillar.mesh = pillar_mesh
		pillar.position = Vector3(side * 5.2, 2.7, 0)
		pillar.material_override = frame_mat
		arch.add_child(pillar)
	var header := MeshInstance3D.new()
	var header_mesh := BoxMesh.new()
	header_mesh.size = Vector3(11.0, 0.62, 0.72)
	header.mesh = header_mesh
	header.position = Vector3(0, 5.25, 0)
	header.material_override = frame_mat
	arch.add_child(header)
	var plaque := MeshInstance3D.new()
	var plaque_mesh := BoxMesh.new()
	plaque_mesh.size = Vector3(7.6, 1.1, 0.16)
	plaque.mesh = plaque_mesh
	plaque.position = Vector3(0, 4.35, -0.42)
	plaque.material_override = _make_material(Color("#102b39"), 0.32, 0.25)
	arch.add_child(plaque)
	var title_tag := Label3D.new()
	title_tag.text = "أهلاً بيك في لَمّة"
	if arabic_font != null:
		title_tag.font = arabic_font
	title_tag.position = Vector3(0, 4.25, -0.30)
	title_tag.font_size = 36
	title_tag.pixel_size = 0.012
	title_tag.modulate = Color("#b8fff0")
	arch.add_child(title_tag)
