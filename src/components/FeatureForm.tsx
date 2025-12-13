import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { LayerId } from "../lib/geo/schema";
import { getLayerSchema, getLayerUiSchema } from "../lib/geo/schema";
import { layerConfigById } from "../lib/geo/layerConfig";
import PhotoGalleryWidget from "./forms/PhotoGalleryWidget";
import { useRef, useCallback } from "react";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

export type FeatureFormProps = {
	layerId: LayerId;
	initialValues?: Record<string, unknown>;
	onSubmit: (values: Record<string, unknown>) => void;
	onCancel?: () => void;
};

export default function FeatureForm({
	layerId,
	initialValues,
	onSubmit,
	onCancel
}: FeatureFormProps) {
	const schema = useMemo(() => getLayerSchema(layerId), [layerId]);
	const baseUiSchema = useMemo(() => getLayerUiSchema(layerId) ?? {}, [layerId]);
	const config = layerConfigById[layerId];
	const formRef = useRef<any>(null);

	const uiSchema = useMemo(() => {
		const merged = { ...baseUiSchema };
		if ((schema as any)?.properties?.photos && !merged.photos) {
			merged.photos = { "ui:widget": "PhotoGallery" };
		}
		if ((schema as any)?.properties?.notes && !merged.notes) {
			merged.notes = {
				"ui:widget": "textarea",
				"ui:options": { rows: 3 },
				"ui:autofocus": true
			};
		}
		return merged;
	}, [baseUiSchema, schema]);

	const widgets = useMemo(
		() => ({
			PhotoGallery: PhotoGalleryWidget
		}),
		[]
	);
	const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			try {
				const node: HTMLFormElement | null = (formRef.current?.formElement as HTMLFormElement) || null;
				if (node && typeof node.requestSubmit === "function") {
					node.requestSubmit();
					e.preventDefault();
				}
			} catch {
				// ignore
			}
		}
	}, []);
	return (
		<div
			style={{
				minWidth: 380,
				maxWidth: 540,
				background: colors.bgPanelSolid,
				borderRadius: borderRadius.xl,
				padding: spacing.xxl,
				boxShadow: colors.shadowXLarge,
				border: `1px solid ${colors.border}`
			}}
			onKeyDown={onKeyDown}
		>
			<div style={{ display: "flex", alignItems: "center", gap: spacing.lg, marginBottom: spacing.xl }}>
				<span style={{ fontSize: 20 }}>{config.icon ?? "📍"}</span>
				<div>
					<h3 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{config.label}</h3>
					<p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
						Add the details below and hit save when you're done.
					</p>
				</div>
			</div>
			<Form
				ref={formRef as any}
				schema={schema as any}
				formData={initialValues as any}
				uiSchema={uiSchema as any}
				widgets={widgets as any}
				validator={validator}
				onSubmit={(e) => onSubmit(e.formData as any)}
			>
				<div style={{ display: "flex", gap: spacing.lg, justifyContent: "flex-end", marginTop: spacing.lg }}>
					{onCancel ? (
						<button
							type="button"
							onClick={onCancel}
							style={{
								padding: `${spacing.sm} ${spacing.xl}`,
								borderRadius: borderRadius.md,
								border: `1px solid ${colors.borderMedium}`,
								background: colors.bgButton,
								color: colors.textSecondary,
								fontSize: typography.fontSize.sm,
								fontWeight: typography.fontWeight.medium,
								cursor: "pointer",
								transition: "all 0.2s ease"
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = colors.bgButtonHover;
								e.currentTarget.style.color = colors.textPrimary;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = colors.bgButton;
								e.currentTarget.style.color = colors.textSecondary;
							}}
						>
							Cancel
						</button>
					) : null}
					<button
						type="submit"
						style={{
							padding: `${spacing.sm} ${spacing.xxl}`,
							borderRadius: borderRadius.md,
							border: "none",
							background: colors.primary,
							color: colors.textOnPrimary,
							fontSize: typography.fontSize.sm,
							fontWeight: typography.fontWeight.semibold,
							cursor: "pointer",
							boxShadow: colors.shadowSubtle,
							transition: "all 0.2s ease"
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = colors.primaryHover;
							e.currentTarget.style.boxShadow = colors.shadowGlow;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = colors.primary;
							e.currentTarget.style.boxShadow = colors.shadowSubtle;
						}}
					>
						Save
					</button>
				</div>
			</Form>
		</div>
	);
}


