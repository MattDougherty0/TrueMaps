import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { LayerId } from "../lib/geo/schema";
import { getLayerSchema, getLayerUiSchema } from "../lib/geo/schema";
import { layerConfigById } from "../lib/geo/layerConfig";
import PhotoGalleryWidget from "./forms/PhotoGalleryWidget";
import { useRef, useCallback } from "react";

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
				background: "rgba(255,255,255,0.96)",
				borderRadius: 12,
				padding: 18,
				boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
				border: "1px solid rgba(15, 23, 42, 0.08)"
			}}
			onKeyDown={onKeyDown}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
				<span style={{ fontSize: 20 }}>{config.icon ?? "📍"}</span>
				<div>
					<h3 style={{ margin: 0, fontSize: 16 }}>{config.label}</h3>
					<p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
						Add the details below and hit save when you’re done.
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
				<div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
					{onCancel ? (
						<button
							type="button"
							onClick={onCancel}
							style={{
								padding: "6px 14px",
								borderRadius: 6,
								border: "1px solid rgba(0,0,0,0.12)",
								background: "#f7f7f7",
								cursor: "pointer"
							}}
						>
							Cancel
						</button>
					) : null}
					<button
						type="submit"
						style={{
							padding: "6px 18px",
							borderRadius: 6,
							border: "none",
							background: "#0a84ff",
							color: "#fff",
							fontWeight: 600,
							cursor: "pointer"
						}}
					>
						Save
					</button>
				</div>
			</Form>
		</div>
	);
}


