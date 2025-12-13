import { useEffect, useState } from "react";
import { useUserStore } from "../state/user";
import useAppStore from "../state/store";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

export default function UserSelector() {
	const activeUser = useUserStore((s) => s.activeUser);
	const users = useUserStore((s) => s.users);
	const setActiveUser = useUserStore((s) => s.setActiveUser);
	const loadUsers = useUserStore((s) => s.loadUsers);
	const addUser = useUserStore((s) => s.addUser);
	const [newUser, setNewUser] = useState("");
	const { properties, activePropertyId, setActivePropertyId } = useAppStore();
	const showProperty = Array.isArray(properties) && properties.length > 1;

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	return (
		<div
			style={{
				padding: `${spacing.md} ${spacing.lg}`,
				borderRadius: borderRadius.md,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanel,
				boxShadow: colors.shadowMedium,
				display: "flex",
				flexDirection: "column",
				gap: spacing.sm,
				width: "100%"
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
				<strong style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>
					Active User
				</strong>
				<select
					value={activeUser || ""}
					onChange={(e) => void setActiveUser(e.target.value || null)}
					style={{
						fontSize: typography.fontSize.sm,
						padding: `${spacing.xs} ${spacing.sm}`,
						borderRadius: borderRadius.sm,
						border: `1px solid ${colors.border}`,
						background: colors.bgPanelSolid,
						color: colors.textPrimary,
						cursor: "pointer"
					}}
				>
					<option value="">—</option>
					{users.map((u) => (
						<option key={u} value={u}>
							{u}
						</option>
					))}
				</select>
			</div>
			{showProperty ? (
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
					<strong style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>
						Property
					</strong>
					<select
						value={activePropertyId || ""}
						onChange={(e) => void setActivePropertyId(e.target.value || null)}
						style={{
							fontSize: typography.fontSize.sm,
							padding: `${spacing.xs} ${spacing.sm}`,
							borderRadius: borderRadius.sm,
							border: `1px solid ${colors.border}`,
							background: colors.bgPanelSolid,
							color: colors.textPrimary,
							cursor: "pointer",
							minWidth: 120
						}}
					>
						<option value="">—</option>
						{properties.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</div>
			) : null}
			<div style={{ display: "flex", gap: 6 }}>
				<input
					type="text"
					placeholder="Add user…"
					value={newUser}
					onChange={(e) => setNewUser(e.target.value)}
					style={{
						flex: 1,
						fontSize: typography.fontSize.sm,
						padding: `${spacing.sm} ${spacing.md}`,
						borderRadius: borderRadius.md,
						border: `1px solid ${colors.border}`,
						background: colors.bgPanelSolid,
						color: colors.textPrimary
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
					style={{
						fontSize: typography.fontSize.sm,
						padding: `${spacing.sm} ${spacing.lg}`,
						borderRadius: borderRadius.md,
						border: `1px solid ${colors.borderMedium}`,
						background: colors.bgButton,
						color: colors.textPrimary,
						cursor: "pointer",
						fontWeight: typography.fontWeight.medium,
						transition: "all 0.2s ease"
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = colors.bgButtonHover;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = colors.bgButton;
					}}
				>
					Add
				</button>
			</div>
		</div>
	);
}


