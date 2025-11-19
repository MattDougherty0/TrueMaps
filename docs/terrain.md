# 3D Terrain Data Options

The 3D map now swaps between true 2D OpenLayers and an OL-Cesium globe. When 3D is enabled it can draw relief from three different terrain sources, chosen automatically in this order:

1. **Custom quantized mesh** – point `VITE_CESIUM_TERRAIN_URL` at a Cesium quantized-mesh tileset (e.g. something you build with `cesium-terrain-builder` or import from Ion).  
2. **Cesium Ion tileset** – drop a token into `VITE_CESIUM_ION_TOKEN`. If you also provide `VITE_CESIUM_TERRAIN_ASSET_ID`, that specific asset is used; otherwise the default global terrain (asset 1) streams.  
3. **AWS Terrarium fallback** – when neither of the above is present we stream the open `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` dataset and turn it into a heightmap on the fly. This gives worldwide ~30 m terrain without registering for Cesium or Mapbox.

## 1. Streaming very high-resolution terrain (Cesium Ion)

1. Sign up or sign in at [https://cesium.com/ion](https://cesium.com/ion).  
2. Upload your DEM/DTM (GeoTIFF, IMG, etc.) and wait for Ion to process it into quantized mesh.  
3. Copy the **Access Token** and paste it into a `.env.local` file in the project root:

   ```
   VITE_CESIUM_ION_TOKEN=your_token_here
   VITE_CESIUM_TERRAIN_ASSET_ID=123456  # optional if you want a non-default asset
   ```

   Restart `npm run dev` (Electron will reload automatically). The 3D toggle now streams your Ion terrain with vertical exaggeration control in the UI.

## 2. Using your own quantized-mesh tiles

To stay completely offline you can tile local DEMs yourself:

```bash
brew install cesium-terrain-builder gdal
ctb-tile --format quantized-mesh --zoom 7-14 dem_utm.tif output/quantized
```

Then host the folder with any static server (Electron can read `file://` URLs too). Point Vite at it:

```
VITE_CESIUM_TERRAIN_URL=http://localhost:8080/{z}/{x}/{y}.terrain
# or, for local files:
VITE_CESIUM_TERRAIN_URL=file:///Users/you/terrain/{z}/{x}/{y}.terrain
```

Restart the app; the provider will pull directly from that template.

## 3. AWS Terrarium fallback (no token required)

Out of the box we use Mapzen’s Terrarium tiles (hosted on AWS) whenever Ion is disabled. You can swap the template if you prefer a different terrain PNG service:

```
VITE_TERRAIN_TERRARIUM_URL=https://your-server/terrarium/{z}/{x}/{y}.png
```

The renderer decodes Terrarium RGB pixels into meters on the client and caches tiles in memory, so even the fallback delivers realistic relief comparable to onX/Google Earth.

---

### Tips

- Pair the 3D globe with the existing hillshade overlay when you flip back to 2D, so hunters still see terrain cues without tilting.  
- Keep the exaggeration slider around `1.4x` for Appalachian-style ridges; push to `3–4x` in flatter agricultural ground.  
- Exported prints remain 2D for now. If you need 3D snapshots we can add a Cesium scene capture workflow next.


