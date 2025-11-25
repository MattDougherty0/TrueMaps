# Replicating "Teaser" Setup for Another PA Property

This guide shows you exactly how to duplicate your "teaser" project setup for a new Pennsylvania property.

## What You Have in "Teaser"

Your current setup includes:
- ✅ **Boundary**: `data/property_boundary.geojson`
- ✅ **2D Tiles**: 
  - `tiles/aerial.mbtiles` (1.4MB)
  - `tiles/topo.mbtiles` (6.0MB)
  - `tiles/contours.geojson` (673KB)
  - `tiles/hillshade.mbtiles` (40KB)
  - `tiles/slope.mbtiles` (28KB)
- ✅ **3D Terrain**: Cesium Ion configured (token + asset ID)
- ✅ **UTM Zone**: 17 (for western PA) or 18 (for eastern PA)

---

## Step-by-Step: New PA Property

### Step 1: Create New Project Folder

**Option A: In the App**
1. Open TrueMaps
2. Click **"Create New Project"**
3. Choose location: `/Users/mattdougherty/Desktop/Old Projects/TrueMaps/YourNewPropertyName`
4. Click "Select"

**Option B: Manual**
```bash
mkdir -p "/Users/mattdougherty/Desktop/Old Projects/TrueMaps/YourNewPropertyName"
cd "/Users/mattdougherty/Desktop/Old Projects/TrueMaps/YourNewPropertyName"
mkdir -p data tiles media exports
```

---

### Step 2: Copy Terrain Configuration

The `.env.local` file is **shared across all projects** (it's in the app root, not the project folder).

**If you already have `.env.local` with Cesium Ion token:**
- ✅ You're all set! The same token works for all projects
- The app will use the same Cesium Ion terrain for 3D views

**If you need to set it up:**
1. Create/edit `.env.local` in the app root:
   ```
   /Users/mattdougherty/Desktop/Old Projects/HuntMaps/.env.local
   ```
2. Add your Cesium Ion token (same one from teaser):
   ```
   VITE_CESIUM_ION_TOKEN=your_token_here
   VITE_CESIUM_TERRAIN_ASSET_ID=your_asset_id_here
   ```
3. Restart the app

**Note:** If your new property is in a different area, you may want to:
- Upload a new DEM to Cesium Ion for that specific area
- Get a new asset ID
- Or use the same global terrain (works fine for most cases)

---

### Step 3: Add Property Boundary

**In the App:**
1. Open your new project
2. Click **"Boundary Tools"** (top-left)
3. Click **"Import Boundary"**
4. Select your boundary file (GeoJSON or KML)
5. The app will:
   - Auto-detect UTM zone (17 for western PA, 18 for eastern PA)
   - Save to `data/property_boundary.geojson`
   - Center the map on your property

**Or manually:**
- Place your boundary file at: `data/property_boundary.geojson`
- Must be valid GeoJSON with coordinates in WGS84 (EPSG:4326)

---

### Step 4: Get Topographic Data (2D Views)

You need the same tile files for accurate 2D views. Here's how to get them for your new PA property:

#### A. Contour Lines (`tiles/contours.geojson`)

**Option 1: Download from USGS (Easiest)**
1. Go to [USGS National Map Downloader](https://apps.nationalmap.gov/downloader/)
2. Draw a box around your property
3. Select "Contours" layer
4. Download as GeoJSON
5. Save to: `tiles/contours.geojson`

**Option 2: Generate from DEM**
```bash
# If you have a DEM file for your area
gdal_contour -a elevation -i 10 your_dem.tif contours.shp
ogr2ogr -f GeoJSON tiles/contours.geojson contours.shp
```

#### B. Hillshade (`tiles/hillshade.mbtiles`)

**Generate from DEM:**
```bash
# Generate hillshade
gdaldem hillshade -z 1.0 -az 315 -alt 45 your_dem.tif hillshade.tif

# Convert to MBTiles (requires tippecanoe or similar)
# Or use QGIS to export as MBTiles
```

**Or download:**
- Some sources provide pre-made hillshade tiles
- Check USGS or state GIS portals

#### C. Slope Map (`tiles/slope.mbtiles`)

**Generate from DEM:**
```bash
# Calculate slope
gdaldem slope your_dem.tif slope_deg.tif

# Convert to MBTiles
```

#### D. Aerial Imagery (`tiles/aerial.mbtiles`)

**Download from USGS:**
1. [USGS National Map Downloader](https://apps.nationalmap.gov/downloader/)
2. Select "Imagery" → "NAIP" or "USGS Aerial"
3. Download for your area
4. Convert to MBTiles using tools like:
   - QGIS (Raster → Conversion → Translate)
   - `gdal_translate` + `gdal2tiles.py`

**Or use online tiles** (if you have internet):
- The app can use USGS online tiles as fallback
- But offline MBTiles are better for performance

#### E. Topo Map (`tiles/topo.mbtiles`)

**Download from USGS:**
1. [USGS National Map Downloader](https://apps.nationalmap.gov/downloader/)
2. Select "Topographic Maps" → "US Topo"
3. Download for your area
4. Convert to MBTiles

---

### Step 5: Get Elevation Data for 3D (If Needed)

**If using Cesium Ion (Recommended - Same as Teaser):**
- ✅ Already configured in `.env.local`
- The same token/asset works for all projects
- If your new property is far from teaser, consider uploading a new DEM to Ion for better accuracy

**To upload new DEM to Cesium Ion:**
1. Get DEM for your PA property:
   - [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
   - Download GeoTIFF format
2. Go to [cesium.com/ion](https://cesium.com/ion)
3. Upload your DEM
4. Wait for processing
5. Get the new Asset ID
6. Update `.env.local`:
   ```
   VITE_CESIUM_TERRAIN_ASSET_ID=new_asset_id_here
   ```

**If staying offline:**
- Generate quantized mesh tiles (see main guide)
- Point `VITE_CESIUM_TERRAIN_URL` to your local tiles

---

### Step 6: Verify Everything Works

1. **Open the project in TrueMaps**
2. **Check 2D View:**
   - ✅ Boundary displays
   - ✅ Contours show (toggle in Basemap panel)
   - ✅ Hillshade/slope work (toggle overlays)
   - ✅ Aerial/topo basemaps load

3. **Check 3D View:**
   - Click **3D toggle** in Terrain Controls
   - ✅ Terrain loads (check console for messages)
   - ✅ Elevation looks accurate
   - ✅ Adjust vertical exaggeration if needed

---

## Quick Checklist

```
YourNewProperty/
├── project.json                    ✅ Auto-created
├── .env.local                      ✅ Shared (in app root)
├── data/
│   └── property_boundary.geojson   ✅ Import via app
├── tiles/
│   ├── contours.geojson            ⚠️ Download/generate
│   ├── hillshade.mbtiles          ⚠️ Generate from DEM
│   ├── slope.mbtiles               ⚠️ Generate from DEM
│   ├── aerial.mbtiles              ⚠️ Download from USGS
│   └── topo.mbtiles                ⚠️ Download from USGS
└── (other folders auto-created)
```

---

## Data Sources for Pennsylvania

### Free Elevation Data:
- **USGS 3DEP**: [https://www.usgs.gov/3d-elevation-program](https://www.usgs.gov/3d-elevation-program)
  - Search for your PA county/township
  - Download 1/3 arc-second or 1 arc-second DEM
- **PA Spatial Data Access**: [https://www.pasda.psu.edu/](https://www.pasda.psu.edu/)
  - Pennsylvania-specific GIS data

### Free Topographic Data:
- **USGS National Map**: [https://apps.nationalmap.gov/downloader/](https://apps.nationalmap.gov/downloader/)
- **PA Spatial Data Access**: Contours, imagery, topo maps

### Tools:
- **QGIS**: Free, great for viewing/editing geospatial data
- **GDAL**: Command-line tools for processing DEMs
- **Cesium Ion**: For high-quality 3D terrain

---

## Tips for PA Properties

1. **UTM Zones:**
   - Western PA: Zone 17 (EPSG:32617) - like your teaser
   - Eastern PA: Zone 18 (EPSG:32618)
   - App auto-detects based on boundary center

2. **Elevation Data:**
   - PA has good 3DEP coverage
   - 1/3 arc-second (~10m) resolution available for most areas
   - Higher resolution (1m) available in some areas

3. **Contours:**
   - USGS provides 10ft and 20ft contour intervals
   - 10ft is better for hunting/mapping detail

4. **Aerial Imagery:**
   - NAIP (National Agricultural Imagery Program) updated every 2-3 years
   - Good resolution (~1m) and recent dates

---

## Quick Start (Minimal Setup)

If you just want to get started quickly:

1. ✅ Create project folder
2. ✅ Import boundary (app auto-sets UTM zone)
3. ✅ Use existing Cesium Ion token (already in `.env.local`)
4. ⚠️ Add contours later (download from USGS)
5. ⚠️ Add other tiles later as needed

**Minimum for 3D to work:** Just the boundary + Cesium Ion token (already set up!)

**For full 2D accuracy:** Add all tile files (contours, hillshade, slope, aerial, topo)

---

## Need Help?

- Check the main guide: `docs/ADDING_NEW_PARCEL.md`
- Check terrain docs: `docs/terrain.md`
- Console logs show terrain provider status when you toggle 3D

