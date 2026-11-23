extends "res://scripts/world.gd"

# A dedicated Godot battle-royale style lobby. The inherited player, rigged
# Lamma avatar, Firebase presence, camera input and mobile controls stay intact.

func _ready() -> void:
	camera_distance = 4.15
	camera_pitch = -0.08
	super._ready()
	if is_instance_valid(player):
		player.rotation.y = PI
	_update_camera(1.0)

func _build_environment() -> void:
	var world_env := WorldEnvironment.new()
	world_env.name = "WorldEnvironment"
	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#17283b")
	sky_material.sky_horizon_color = Color("#b7a58a")
	sky_material.ground_bottom_color = Color("#1b2528")
	sky_material.ground_horizon_color = Color("#65716c")
	sky.sky_material = sky_material
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#a4b2bf")
	environment.ambient_light_energy = 0.72
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.glow_enabled = true
	environment.glow_intensity = 0.32
	environment.fog_enabled = true
	environment.fog_light_color = Color("#9b9a88")
	environment.fog_density = 0.0045
	environment.fog_sun_scatter = 0.18
	environment.adjustment_enabled = true
	environment.adjustment_brightness = 1.02
	environment.adjustment_contrast = 1.16
	environment.adjustment_saturation = 0.82
	world_env.environment = environment
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.name = "LateAfternoonSun"
	sun.rotation_degrees = Vector3(-37, -28, 0)
	sun.light_color = Color("#ffe0b1")
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 75.0
	add_child(sun)

	# Large military training ground and runway.
	var military_ground := _make_box("MilitaryGround", Vector3(0, -0.55, 0), Vector3(110, 1, 110), Color("#465047"), 0.98)
	military_ground.material_override = _make_ground_material(Color("#465047"), Color("#303a35"), 0.075)
	var main_asphalt := _make_box("MainAsphalt", Vector3(0, 0.015, 0), Vector3(23, 0.12, 82), Color("#343b3b"), 0.92)
	main_asphalt.material_override = _make_ground_material(Color("#454a48"), Color("#252d2d"), 0.12)
	_make_box("RunwayCenterLine", Vector3(0, 0.083, -2), Vector3(0.18, 0.018, 62), Color("#c5b98f"), 0.8)
	for z in range(-32, 34, 8):
		_detail_box("RunwayDash", Vector3(0, 0.095, float(z)), Vector3(0.34, 0.025, 3.2), Color("#e0d7b8"), 0.82)
	for side in [-1.0, 1.0]:
		_detail_box("RunwayEdge", Vector3(side * 10.7, 0.09, 0), Vector3(0.12, 0.025, 78), Color("#a7a18a"), 0.85)
		_make_box("PerimeterRoad", Vector3(side * 27.0, 0.015, -1), Vector3(8, 0.1, 82), Color("#3d4541"), 0.95)
		_detail_box("RoadShoulder", Vector3(side * 22.8, 0.09, -1), Vector3(0.22, 0.04, 82), Color("#958b71"), 0.9)

	_build_hangars()
	_build_watchtowers()
	_build_supply_area()
	_build_distant_mountains()
	_build_military_lighting()
	_build_lobby_signage()

func _build_hangars() -> void:
	for side in [-1.0, 1.0]:
		var center := Vector3(side * 18.0, 0.0, -17.0)
		_make_box("HangarBody", center + Vector3(0, 3.0, 0), Vector3(13, 6, 15), Color("#59615d"), 0.78)
		_make_box("HangarRoof", center + Vector3(0, 6.25, 0), Vector3(13.8, 0.5, 15.8), Color("#303b3b"), 0.55)
		_make_box("HangarDoor", center + Vector3(0, 2.4, 7.56), Vector3(8.6, 4.8, 0.12), Color("#252e30"), 0.48)
		for x in [-4.2, -2.1, 0.0, 2.1, 4.2]:
			_detail_box("HangarDoorRib", center + Vector3(x, 2.4, 7.66), Vector3(0.08, 4.5, 0.08), Color("#788078"), 0.48, 0.28)
		for x in [-5.9, 5.9]:
			_make_box("HangarSupport", center + Vector3(x, 3.0, 7.7), Vector3(0.32, 6.0, 0.35), Color("#a08e6d"), 0.5)
		_make_box("HangarWarningStripe", center + Vector3(0, 0.22, 7.72), Vector3(9.2, 0.22, 0.18), Color("#c59a4f"), 0.6)
		_detail_box("HangarNumberPlate", center + Vector3(0, 5.35, 7.72), Vector3(2.4, 0.55, 0.12), Color("#18262b"), 0.38)

func _build_watchtowers() -> void:
	for side in [-1.0, 1.0]:
		var x := side * 34.0
		_make_box("TowerLegLeft", Vector3(x - 1.3, 4.0, -18), Vector3(0.32, 8, 0.32), Color("#424c49"), 0.55)
		_make_box("TowerLegRight", Vector3(x + 1.3, 4.0, -18), Vector3(0.32, 8, 0.32), Color("#424c49"), 0.55)
		_make_box("TowerCrossBeam", Vector3(x, 7.4, -18), Vector3(3.0, 0.28, 0.32), Color("#b49a6b"), 0.48)
		_make_box("TowerCabin", Vector3(x, 8.7, -18), Vector3(4.2, 2.3, 4.0), Color("#59645d"), 0.62)
		_make_box("TowerRoof", Vector3(x, 10.0, -18), Vector3(4.7, 0.3, 4.5), Color("#273536"), 0.4)
		for dx in [-1.0, 1.0]:
			_detail_box("TowerWindow", Vector3(x + dx * 1.9, 8.85, -18), Vector3(0.04, 1.1, 1.65), Color("#8da5a1"), 0.2, 0.2)

func _build_supply_area() -> void:
	var crate_colors := [Color("#58634d"), Color("#6c624c"), Color("#454f49")]
	for i in range(15):
		var row := int(i / 5)
		var col := i % 5
		var x := -8.0 + float(col) * 4.0
		var z := -9.0 - float(row) * 4.0
		var size := Vector3(2.2, 1.8, 2.1) if row != 2 else Vector3(2.2, 3.2, 2.1)
		_make_box("SupplyCrate", Vector3(x, size.y * 0.5, z), size, crate_colors[i % crate_colors.size()], 0.9)
		_detail_box("CrateBand", Vector3(x, size.y * 0.5, z + 1.07), Vector3(2.0, 0.12, 0.06), Color("#b59b66"), 0.5, 0.3)
	for side in [-1.0, 1.0]:
		for z in [-25.0, -13.0, 1.0, 15.0, 28.0]:
			_make_box("ConcreteBarrier", Vector3(side * 14.0, 0.7, z), Vector3(2.2, 1.4, 1.0), Color("#77786b"), 0.95)
			_detail_box("BarrierStripe", Vector3(side * 14.0, 0.74, z + 0.52), Vector3(1.5, 0.45, 0.05), Color("#b28a4d"), 0.7)

func _build_distant_mountains() -> void:
	for i in range(13):
		var mountain := MeshInstance3D.new()
		var cone := ConeMesh.new()
		cone.bottom_radius = 7.0 + float(i % 4) * 2.2
		cone.top_radius = 0.25
		cone.height = 18.0 + float(i % 5) * 3.0
		cone.radial_segments = 7
		mountain.mesh = cone
		var side := -1.0 if i % 2 == 0 else 1.0
		mountain.position = Vector3(side * (42.0 + float(i % 4) * 8.0), cone.height * 0.5 - 2.0, -42.0 + float(i) * 7.0)
		mountain.rotation_degrees = Vector3(0, float(i) * 31.0, float((i % 3) - 1) * 3.0)
		mountain.material_override = _make_material(Color("#4d5a56") if i % 2 == 0 else Color("#657067"), 1.0)
		add_child(mountain)

func _build_military_lighting() -> void:
	for side in [-1.0, 1.0]:
		for z in [-27.0, 0.0, 27.0]:
			var pole := MeshInstance3D.new()
			var pole_mesh := CylinderMesh.new()
			pole_mesh.top_radius = 0.08
			pole_mesh.bottom_radius = 0.14
			pole_mesh.height = 8.0
			pole.mesh = pole_mesh
			pole.position = Vector3(side * 24.0, 4.0, z)
			pole.material_override = _make_material(Color("#303b3b"), 0.4, 0.5)
			add_child(pole)
			_detail_box("FloodlightHead", Vector3(side * 24.0, 8.0, z), Vector3(1.1, 0.3, 0.55), Color("#d1c6a2"), 0.28, 0.25)
	for i in range(7):
		var pole := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.035
		mesh.bottom_radius = 0.055
		mesh.height = 5.0
		pole.mesh = mesh
		pole.position = Vector3(-30.0 + float(i) * 10.0, 2.5, 31.0)
		pole.material_override = _make_material(Color("#394440"), 0.45, 0.35)
		add_child(pole)
		var flag := _detail_box("CampFlag", Vector3(-28.9 + float(i) * 10.0, 4.1, 31.0), Vector3(2.0, 1.1, 0.06), Color("#9a7444"), 0.85)
		flag.rotation.y = deg_to_rad(-8.0)

func _build_lobby_signage() -> void:
	_make_box("LammaLobbySignFrame", Vector3(0, 4.3, -34.0), Vector3(15.0, 3.0, 0.55), Color("#1b2929"), 0.42)
	_make_box("LammaLobbySignFace", Vector3(0, 4.3, -33.68), Vector3(14.4, 2.45, 0.08), Color("#34483f"), 0.48)
	var title := Label3D.new()
	title.name = "LammaBattleSign"
	title.text = "LAMMA  //  BATTLE CAMP"
	title.position = Vector3(0, 4.45, -33.58)
	title.font_size = 54
	title.pixel_size = 0.009
	title.modulate = Color("#e7d2a5")
	add_child(title)
	var subtitle := Label3D.new()
	subtitle.text = "TRAIN • PREPARE • PLAY"
	subtitle.position = Vector3(0, 3.65, -33.55)
	subtitle.font_size = 22
	subtitle.pixel_size = 0.009
	subtitle.modulate = Color("#b8c7b9")
	add_child(subtitle)

func _build_player() -> void:
	super._build_player()
	player.position = Vector3(0, 0.1, 7.0)
	player.rotation.y = PI

func _build_camera() -> void:
	super._build_camera()
	camera_distance = 4.15
	camera_pitch = -0.08
	camera.fov = 56.0
	_update_camera(1.0)

func _build_hud() -> void:
	super._build_hud()
	var root := ui_layer.get_node("Root") as Control
	# Remove the old social-world title; replace it with a compact military lobby identity.
	var old_title := root.get_node_or_null("Title")
	if old_title != null:
		old_title.queue_free()
	var brand := Label.new()
	brand.name = "BattleLobbyBrand"
	brand.text = "لَمّة  |  BATTLE CAMP"
	brand.position = Vector2(24, 18)
	brand.size = Vector2(390, 42)
	brand.add_theme_font_size_override("font_size", 25)
	brand.add_theme_color_override("font_color", Color("#f0dfbd"))
	root.add_child(brand)

	var panel := PanelContainer.new()
	panel.name = "LobbyInfoPanel"
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -302
	panel.offset_right = -22
	panel.offset_top = 116
	panel.offset_bottom = 292
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.035, 0.065, 0.07, 0.88)
	panel_style.border_color = Color("#9c8355")
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(12)
	panel_style.content_margin_left = 18
	panel_style.content_margin_right = 18
	panel_style.content_margin_top = 14
	panel_style.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", panel_style)
	var info := VBoxContainer.new()
	info.add_theme_constant_override("separation", 8)
	panel.add_child(info)
	var heading := Label.new()
	heading.text = "معسكر لَمّة"
	heading.add_theme_font_size_override("font_size", 22)
	heading.add_theme_color_override("font_color", Color("#e8d2a8"))
	info.add_child(heading)
	var line := HSeparator.new()
	info.add_child(line)
	var mode := Label.new()
	mode.text = "ساحة الاستعداد"
	mode.add_theme_font_size_override("font_size", 17)
	mode.add_theme_color_override("font_color", Color("#eff4ed"))
	info.add_child(mode)
	var players := Label.new()
	players.text = "اللاعبون المتصلون يظهرون هنا تلقائياً"
	players.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	players.add_theme_font_size_override("font_size", 13)
	players.add_theme_color_override("font_color", Color("#b9c4b7"))
	info.add_child(players)
	root.add_child(panel)

	var footer := PanelContainer.new()
	footer.name = "LobbyFooter"
	footer.anchor_left = 0.5
	footer.anchor_right = 0.5
	footer.anchor_top = 1.0
	footer.anchor_bottom = 1.0
	footer.offset_left = -190
	footer.offset_right = 190
	footer.offset_top = -72
	footer.offset_bottom = -30
	var footer_style := StyleBoxFlat.new()
	footer_style.bg_color = Color(0.035, 0.06, 0.065, 0.78)
	footer_style.border_color = Color(0.55, 0.47, 0.32, 0.72)
	footer_style.set_border_width_all(1)
	footer_style.set_corner_radius_all(9)
	footer.add_theme_stylebox_override("panel", footer_style)
	var footer_text := Label.new()
	footer_text.text = "BATTLE CAMP  •  SEASON 01"
	footer_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	footer_text.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	footer_text.add_theme_font_size_override("font_size", 15)
	footer_text.add_theme_color_override("font_color", Color("#e1d0ac"))
	footer.add_child(footer_text)
	root.add_child(footer)


# Procedural, tile-free surface detail keeps the arena readable without large
# texture downloads. The Mobile renderer supports this spatial shader.
func _make_ground_material(light_tone: Color, dark_tone: Color, detail_strength: float) -> ShaderMaterial:
	var shader := Shader.new()
	shader.code = """
	shader_type spatial;
	render_mode diffuse_burley, specular_schlick_ggx;
	uniform vec4 light_tone : source_color = vec4(0.27, 0.30, 0.28, 1.0);
	uniform vec4 dark_tone : source_color = vec4(0.13, 0.16, 0.15, 1.0);
	uniform float detail_strength = 0.1;
	float hash21(vec2 p) {
		p = fract(p * vec2(123.34, 456.21));
		p += dot(p, p + 45.32);
		return fract(p.x * p.y);
	}
	float noise2(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
			mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
	}
	void fragment() {
		vec2 p = UV * vec2(190.0, 270.0);
		float grain = noise2(p) * 0.62 + noise2(p * 3.7) * 0.25 + noise2(p * 11.0) * 0.13;
		float variation = (grain - 0.5) * detail_strength;
		ALBEDO = mix(dark_tone.rgb, light_tone.rgb, clamp(0.48 + variation * 3.0, 0.0, 1.0));
		ROUGHNESS = 0.94;
		SPECULAR = 0.18;
	}
	"""
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("light_tone", light_tone)
	material.set_shader_parameter("dark_tone", dark_tone)
	material.set_shader_parameter("detail_strength", detail_strength)
	return material
