extends CharacterBody3D

var game
var bot_id := 0
var hp := 100
var timer := 0.0
var target_dir := Vector3.ZERO
var visual: Node3D
var walk_time := 0.0

func _mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.82
	return m

func _part(parent: Node3D, mesh: Mesh, pos: Vector3, material: Material) -> void:
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = pos
	node.material_override = material
	parent.add_child(node)

func _box(size: Vector3) -> BoxMesh:
	var m := BoxMesh.new()
	m.size = size
	return m

func _build_enemy() -> void:
	visual = Node3D.new()
	add_child(visual)
	var cloth := _mat(Color(0.30,0.20,0.15))
	var armor := _mat(Color(0.16,0.19,0.17))
	var skin := _mat(Color(0.62,0.43,0.31))
	var dark := _mat(Color(0.055,0.06,0.055))
	_part(visual,_box(Vector3(0.72,0.78,0.38)),Vector3(0,1.18,0),cloth)
	_part(visual,_box(Vector3(0.62,0.58,0.15)),Vector3(0,1.22,-0.22),armor)
	_part(visual,_box(Vector3(0.42,0.55,0.20)),Vector3(0,1.28,0.28),dark)
	_part(visual,_box(Vector3(0.20,0.18,0.18)),Vector3(-0.20,1.02,-0.31),dark)
	_part(visual,_box(Vector3(0.20,0.18,0.18)),Vector3(0.20,1.02,-0.31),dark)
	var head := SphereMesh.new()
	head.radius = 0.22
	head.height = 0.42
	_part(visual,head,Vector3(0,1.88,0),skin)
	var helmet := SphereMesh.new()
	helmet.radius = 0.25
	helmet.height = 0.23
	_part(visual,helmet,Vector3(0,2.06,0),armor)
	_part(visual,_box(Vector3(0.50,0.09,0.32)),Vector3(0,1.98,-0.02),dark)
	for side in [-1.0,1.0]:
		var leg := CapsuleMesh.new()
		leg.radius = 0.15
		leg.height = 0.72
		_part(visual,leg,Vector3(side*0.20,0.48,0),cloth)
		_part(visual,_box(Vector3(0.27,0.15,0.38)),Vector3(side*0.20,0.12,-0.07),dark)
		var arm := CapsuleMesh.new()
		arm.radius = 0.13
		arm.height = 0.70
		_part(visual,arm,Vector3(side*0.43,1.20,-0.06),cloth)
	_part(visual,_box(Vector3(0.11,0.12,0.72)),Vector3(0.32,1.18,-0.48),dark)
	_part(visual,_box(Vector3(0.13,0.20,0.16)),Vector3(0.32,1.10,-0.22),armor)
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.36
	shape.height = 2.0
	col.shape = shape
	col.position.y = 1.0
	add_child(col)
	var label := Label3D.new()
	label.text = "HOSTILE %02d" % bot_id
	label.position.y = 2.42
	label.font_size = 25
	label.modulate = Color(1,0.52,0.34)
	add_child(label)

func setup(owner_game, number: int) -> void:
	game = owner_game
	bot_id = number
	_build_enemy()
	_pick_direction()

func _physics_process(delta: float) -> void:
	timer -= delta
	if timer <= 0:
		_pick_direction()
	var dir := target_dir
	velocity.x = dir.x * 2.2
	velocity.z = dir.z * 2.2
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0
	move_and_slide()
	if dir.length() > 0.1:
		rotation.y = atan2(-dir.x,-dir.z)
		walk_time += delta * 7.0
	if game and is_instance_valid(game.player) and global_position.distance_to(game.player.global_position) < 22:
		look_at(Vector3(game.player.global_position.x, global_position.y, game.player.global_position.z), Vector3.UP)

func _pick_direction() -> void:
	timer = randf_range(2.0,5.0)
	target_dir = Vector3(randf_range(-1,1),0,randf_range(-1,1)).normalized()

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		if game:
			game.register_kill()
	queue_free()
