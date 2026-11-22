extends CharacterBody3D

var game
var bot_id := 0
var hp := 100
var timer := 0.0
var target_dir := Vector3.ZERO

func setup(owner_game, number: int) -> void:
	game = owner_game
	bot_id = number
	var body := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.4
	mesh.height = 1.65
	body.mesh = mesh
	body.position.y = 0.95
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.34,0.23,0.16)
	body.material_override = mat
	add_child(body)
	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.22
	head.mesh = sphere
	head.position.y = 2.0
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.65,0.48,0.36)
	head.material_override = skin
	add_child(head)
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.4
	shape.height = 2.0
	col.shape = shape
	add_child(col)
	var label := Label3D.new()
	label.text = "HOSTILE %02d" % bot_id
	label.position.y = 2.45
	label.font_size = 28
	label.modulate = Color(1,0.55,0.35)
	add_child(label)
	_pick_direction()

func _physics_process(delta: float) -> void:
	timer -= delta
	if timer <= 0:
		_pick_direction()
	var dir := target_dir
	velocity.x = dir.x * 1.8
	velocity.z = dir.z * 1.8
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = 0
	move_and_slide()
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
