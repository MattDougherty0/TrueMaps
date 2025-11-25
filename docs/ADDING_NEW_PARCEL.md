# Adding a New Parcel of Land - Complete Guide

This guide walks you through adding another parcel to TrueMaps with accurate 2D and 3D terrain views.

## Overview

Each parcel needs:
1. **Boundary file** (GeoJSON/KML) - defines the property outline
2. **Topographic data** - for 2D views (contours, hillshade, slope)
3. **Terrain elevation data** - for 3D views (DEM/DTM)
4. **Project structure** - organized folder with all data files

---

## Step 1: Create a New Project

### Option A: Create New Project in App
1. Open TrueMaps
2. Click **"Create New Project"**
3. Choose a folder location (e.g., `/Users/you/Documents/TrueMaps/Parcel2`)
4. The app will create the folder structure automatically

### Option B: Manual Setup
Create a folder structure like this:
```
YourParcel/
├── data/              (will contain GeoJSON files)
├── tiles/             (will contain terrain tiles)
├── media/             (photos, videos)
├── exports/           (exported maps)
└── project.json       (project metadata)
```

---

## Step 2: Add the Property Boundary

### Method 1: Import from File (Recommended)
1. In the app, click **"Boundary Tools"** (top-left when no boundary exists)
2. Click **"Import Boundary"**
3. Select your boundary file:
   - **GeoJSON** (`.geojson` or `.json`) - preferred format
   - **KML** (`.kml`) - from Google Earth, onX, etc.
   - **GPX** (`.gpx`) - GPS tracks
4. The app will:
   - Load the boundary
   - Calculate the center point
   - Auto-select the correct UTM zone for your location
   - Save to `data/property_boundary.geojson`

### Method 2: Draw Manually
1. Click **"Draw Boundary"**
2. Click on the map to create polygon vertices
3. Double-click to finish
4. Boundary is automatically saved

### Method 3: Prepare Boundary File Manually
Create `data/property_boundary.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Property",
        "acres": 0.0,
        "notes": ""
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-84.1234, 39.5678],
          [-84.1235, 39.5678],
          [-84.1235, 39.5679],
          [-84.1234, 39.5679],
          [-84.1234, 39.5678]
        ]]
      }
    }
  ]
}
```
**Note:** Coordinates must be in WGS84 (EPSG:4326) - longitude, latitude format.

---

## Step 3: Get Topographic Data for 2D Views

The app uses several tile types for 2D visualization:

### A. Contour Lines (`tiles/contours.geojson` or `tiles/contours.mbtiles`)

**Option 1: Generate from DEM (Recommended)**
```bash
# Install GDAL if needed
brew install gdal

# Generate contours from your DEM
gdal_contour -a elevation -i 10 dem_utm.tif contours.shp

# Convert to GeoJSON
ogr2ogr -f GeoJSON contours.geojson contours.shp

# Copy to project
cp contours.geojson YourParcel/tiles/contours.geojson
```

**Option 2: Download from USGS**
- Visit [USGS National Map](https://apps.nationalmap.gov/downloader/)
- Download contour data for your area
- Convert to GeoJSON if needed

**Option 3: Use MBTiles (for large areas)**
```bash
# If you have contours as MBTiles
cp your-contours.mbtiles YourParcel/tiles/contours.mbtiles
```

### B. Hillshade (`tiles/hillshade.mbtiles` or `tiles/hillshade.tif`)

Generate from DEM:
```bash
# Generate hillshade
gdaldem hillshade -z 1.0 -az 315 -alt 45 dem_utm.tif hillshade.tif

# Convert to MBTiles (optional, for better performance)
# Use tools like tippecanoe or mbutil
```

### C. Slope Map (`tiles/slope.mbtiles` or `tiles/slope_deg.tif`)

Generate from DEM:
```bash
# Calculate slope in degrees
gdaldem slope dem_utm.tif slope_deg.tif

# Or convert to MBTiles for better performance
```

### D. Aerial/Topo Basemaps (`tiles/aerial.mbtiles`, `tiles/topo.mbtiles`)

**Option 1: Download from USGS**
- [USGS National Map Downloader](https://apps.nationalmap.gov/downloader/)
- Download aerial imagery or topo maps
- Convert to MBTiles format

**Option 2: Use Online Sources (if online)**
- The app can use USGS online tiles as fallback
- For offline use, you need local MBTiles

---

## Step 4: Get Elevation Data for 3D Views

### Option 1: Cesium Ion (Easiest, Best Quality) ⭐ Recommended

1. **Sign up at [cesium.com/ion](https://cesium.com/ion)** (free tier available)

2. **Get your DEM/DTM file:**
   - Download from [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
   - Or use your own GeoTIFF/IMG elevation data

3. **Upload to Cesium Ion:**
   - Go to Ion dashboard
   - Click "Add Data" → "Upload"
   - Upload your DEM file
   - Wait for processing (can take 10-30 minutes)

4. **Get your Access Token:**
   - Ion dashboard → "Access Tokens"
   - Copy your default token

5. **Configure in TrueMaps:**
   - Create/edit `.env.local` in the project root:
   ```
   VITE_CESIUM_ION_TOKEN=your_token_here
   VITE_CESIUM_TERRAIN_ASSET_ID=123456  # The asset ID from Ion (optional)
   ```
   - Restart the app (`npm run dev`)

6. **Result:** High-resolution 3D terrain with accurate elevation

### Option 2: Local Quantized Mesh (Fully Offline)

1. **Get your DEM file:**
   ```bash
   # Download from USGS or use existing
   # File should be in UTM projection matching your parcel location
   ```

2. **Install cesium-terrain-builder:**
   ```bash
   brew install cesium-terrain-builder gdal
   ```

3. **Generate quantized mesh tiles:**
   ```bash
   ctb-tile --format quantized-mesh \
     --zoom 7-14 \
     --output-dir terrain-tiles \
     dem_utm.tif
   ```

4. **Configure in TrueMaps:**
   - Create/edit `.env.local`:
   ```
   VITE_CESIUM_TERRAIN_URL=file:///absolute/path/to/terrain-tiles/{z}/{x}/{y}.terrain
   ```
   - Or host on local server:
   ```
   VITE_CESIUM_TERRAIN_URL=http://localhost:8080/{z}/{x}/{y}.terrain
   ```

5. **Restart the app**

### Option 3: AWS Terrarium (Free, Lower Resolution)

- **No setup needed!** The app uses this automatically if no Ion token or custom terrain URL is provided
- Provides ~30m resolution worldwide terrain
- Works offline (tiles are streamed from AWS)
- Good enough for general visualization

**To customize the Terrarium URL:**
```
VITE_TERRAIN_TERRARIUM_URL=https://your-server/terrarium/{z}/{x}/{y}.png
```

---

## Step 5: Coordinate System Setup

The app automatically:
1. Detects the center of your boundary
2. Selects the appropriate UTM zone
3. Sets up the projection in `project.json`

**Manual override** (if needed):
Edit `project.json`:
```json
{
  "name": "Your Parcel Name",
  "crs": {
    "code": "EPSG:32617",  // UTM zone code
    "utmZone": 17,
    "isNorthern": true
  }
}
```

---

## Step 6: Verify Everything Works

### Check 2D View:
1. ✅ Boundary displays correctly
2. ✅ Contours show (if added)
3. ✅ Hillshade/slope overlays work
4. ✅ Basemap (aerial/topo) displays

### Check 3D View:
1. Click the **3D toggle** in Terrain Controls
2. ✅ Terrain loads (check console for terrain provider messages)
3. ✅ Elevation looks accurate
4. ✅ Adjust vertical exaggeration if needed (slider in Terrain Controls)

---

## Quick Reference: File Checklist

```
YourParcel/
├── project.json                    ✅ Project metadata
├── data/
│   └── property_boundary.geojson   ✅ Property outline
├── tiles/
│   ├── contours.geojson            ⚠️ Optional (for contour lines)
│   ├── contours.mbtiles             ⚠️ Alternative to GeoJSON
│   ├── hillshade.mbtiles           ⚠️ Optional (for hillshade overlay)
│   ├── hillshade.tif                ⚠️ Alternative format
│   ├── slope.mbtiles                ⚠️ Optional (for slope overlay)
│   ├── slope_deg.tif                 ⚠️ Alternative format
│   ├── aerial.mbtiles               ⚠️ Optional (offline aerial)
│   ├── topo.mbtiles                 ⚠️ Optional (offline topo)
│   └── dem_utm.tif                  ⚠️ Source DEM (for generating other tiles)
└── .env.local                       ⚠️ Terrain configuration (for 3D)
```

**Legend:**
- ✅ **Required**
- ⚠️ **Optional but recommended**

---

## Common Issues & Solutions

### Issue: 3D view shows flat terrain
**Solution:** 
- Check `.env.local` has `VITE_CESIUM_ION_TOKEN` set
- Or verify `VITE_CESIUM_TERRAIN_URL` points to valid quantized mesh
- Check browser console for terrain errors

### Issue: Contours don't show
**Solution:**
- Verify `tiles/contours.geojson` exists and is valid GeoJSON
- Check coordinates are in WGS84 (EPSG:4326)
- Enable contours in Basemap Toggles panel

### Issue: Boundary is in wrong location
**Solution:**
- Verify boundary coordinates are in WGS84 (longitude, latitude)
- Check coordinate order: `[lon, lat]` not `[lat, lon]`
- Re-import the boundary file

### Issue: Tiles don't load
**Solution:**
- Verify MBTiles files are valid (use `sqlite3 tiles/hillshade.mbtiles "SELECT COUNT(*) FROM tiles;"`)
- Check file paths in project structure
- Restart the app after adding new tiles

---

## Data Sources

### Free Elevation Data:
- **USGS 3D Elevation Program (3DEP)**: [https://www.usgs.gov/3d-elevation-program](https://www.usgs.gov/3d-elevation-program)
- **NASA SRTM**: [https://earthexplorer.usgs.gov/](https://earthexplorer.usgs.gov/)
- **OpenTopography**: [https://opentopography.org/](https://opentopography.org/)

### Free Topographic Data:
- **USGS National Map**: [https://apps.nationalmap.gov/downloader/](https://apps.nationalmap.gov/downloader/)
- **OpenStreetMap**: [https://www.openstreetmap.org/](https://www.openstreetmap.org/)

### Tools:
- **GDAL**: For processing DEMs and generating tiles
- **cesium-terrain-builder**: For creating quantized mesh tiles
- **tippecanoe**: For creating MBTiles from GeoJSON
- **QGIS**: For viewing and editing geospatial data

---

## Next Steps

Once your parcel is set up:
1. Add hunting data (trails, stands, sightings, etc.)
2. Import OnX data if you have it
3. Add photos and media
4. Create custom layers
5. Export maps for printing

