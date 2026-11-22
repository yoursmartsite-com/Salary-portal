extends Node

signal connected(uid: String, player_name: String)
signal players_changed(players: Dictionary)
signal failed(reason: String)

var _ready_callback
var _players_callback
var _error_callback
var _started := false

func start() -> void:
	if _started:
		return
	if not OS.has_feature("web"):
		failed.emit("الاتصال الجماعي يحتاج نسخة الويب")
		return
	_started = true
	var window := JavaScriptBridge.get_interface("window")
	_ready_callback = JavaScriptBridge.create_callback(_on_ready)
	_players_callback = JavaScriptBridge.create_callback(_on_players)
	_error_callback = JavaScriptBridge.create_callback(_on_error)
	window.set("lammaHubReadyCallback", _ready_callback)
	window.set("lammaHubPlayersCallback", _players_callback)
	window.set("lammaHubErrorCallback", _error_callback)
	var bridge_code := """
	(async function () {
		try {
			const module = await import("../firebase-session.js");
			const session = await module.getFirebaseSession({ waitForDatabase: true, timeoutMs: 20000 });
			const dbm = session.dbMod;
			const uid = session.uid;
			const roomPath = "onlineRooms/lamma_hub_" + uid;
			const roomRef = dbm.ref(session.db, roomPath);
			const existing = await dbm.get(roomRef);
			if (!existing.exists()) {
				await dbm.set(roomRef, {
					host: uid,
					game: { type: "lamma_hub", title: "عالم لَمّة" },
					players: {}
				});
			}
			const playerRef = dbm.ref(session.db, roomPath + "/players/" + uid);
			await dbm.onDisconnect(playerRef).remove();
			const playerName = localStorage.getItem("arcade_name") || "لاعب";
			let latestPayload = { position: { x: 0, y: 0, z: 5 }, yaw: 0 };
			await dbm.set(playerRef, {
				uid: uid,
				name: playerName,
				position: latestPayload.position,
				yaw: latestPayload.yaw,
				updatedAt: Date.now()
			});
			dbm.onValue(dbm.ref(session.db, ".info/connected"), async connection => {
				if (connection.val() === true) {
					try {
						await dbm.onDisconnect(playerRef).remove();
						await dbm.set(playerRef, {
							uid: uid,
							name: playerName,
							position: latestPayload.position,
							yaw: latestPayload.yaw,
							updatedAt: Date.now()
						});
					} catch (error) {
						if (window.lammaHubErrorCallback) window.lammaHubErrorCallback(String(error));
					}
				}
			});
			dbm.onValue(dbm.ref(session.db, "onlineRooms"), snapshot => {
				if (window.lammaHubPlayersCallback) {
					window.lammaHubPlayersCallback(JSON.stringify(snapshot.val() || {}));
				}
			}, error => {
				if (window.lammaHubErrorCallback) window.lammaHubErrorCallback(String(error));
			});
			window.lammaHubSendPosition = payload => {
				latestPayload = payload;
				return dbm.update(playerRef, {
					position: payload.position,
					yaw: payload.yaw,
					updatedAt: Date.now()
				});
			};
			if (window.lammaHubReadyCallback) window.lammaHubReadyCallback(uid, playerName);
		} catch (error) {
			if (window.lammaHubErrorCallback) window.lammaHubErrorCallback(String(error));
		}
	})();
	"""
	JavaScriptBridge.eval(bridge_code, true)

func send_position(position: Vector3, yaw: float) -> void:
	if not _started or not OS.has_feature("web"):
		return
	var payload := {
		"position": {"x": position.x, "y": position.y, "z": position.z},
		"yaw": yaw
	}
	var encoded := JSON.stringify(payload)
	JavaScriptBridge.eval("if (window.lammaHubSendPosition) window.lammaHubSendPosition(" + encoded + ");", true)

func _on_ready(args: Array) -> void:
	if args.size() > 0:
		connected.emit(str(args[0]), str(args[1]) if args.size() > 1 else "لاعب")

func _on_players(args: Array) -> void:
	if args.is_empty():
		return
	var parsed = JSON.parse_string(str(args[0]))
	if parsed is Dictionary:
		players_changed.emit(parsed)

func _on_error(args: Array) -> void:
	var message := "Firebase connection failed"
	if not args.is_empty():
		message = str(args[0])
	failed.emit(message)
