import { useEffect, useState } from "react";
import { useUserStore } from "../state/user";

export default function UserSelector() {
	const activeUser = useUserStore((s) => s.activeUser);
	const users = useUserStore((s) => s.users);
	const setActiveUser = useUserStore((s) => s.setActiveUser);
	const loadUsers = useUserStore((s) => s.loadUsers);
	const addUser = useUserStore((s) => s.addUser);
	const [newUser, setNewUser] = useState("");

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	return (
		<div
			style={{
				padding: "8px 10px",
				borderRadius: 6,
				border: "1px solid rgba(15,23,42,0.12)",
				background: "rgba(255,255,255,0.94)",
				boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
				display: "flex",
				flexDirection: "column",
				gap: 6,
				width: "100%"
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<strong style={{ fontSize: 12, color: "rgba(15,23,42,0.75)" }}>Active User</strong>
				<select
					value={activeUser || ""}
					onChange={(e) => void setActiveUser(e.target.value || null)}
					style={{ fontSize: 12, padding: "2px 6px" }}
				>
					<option value="">—</option>
					{users.map((u) => (
						<option key={u} value={u}>
							{u}
						</option>
					))}
				</select>
			</div>
			<div style={{ display: "flex", gap: 6 }}>
				<input
					type="text"
					placeholder="Add user…"
					value={newUser}
					onChange={(e) => setNewUser(e.target.value)}
					style={{
						flex: 1,
						fontSize: 12,
						padding: "6px 8px",
						borderRadius: 6,
						border: "1px solid rgba(15,23,42,0.15)"
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && newUser.trim()) {
							void addUser(newUser.trim());
							setNewUser("");
						}
					}}
				/>
				<button
					onClick={() => {
						if (!newUser.trim()) return;
						void addUser(newUser.trim());
						setNewUser("");
					}}
					style={{ fontSize: 12, padding: "6px 10px" }}
				>
					Add
				</button>
			</div>
		</div>
	);
}


