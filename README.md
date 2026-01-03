# TrueMap 🗺️

An open-source desktop mapping application for landowners and hunters to create detailed property maps, track hunts, log sightings, and analyze terrain.

> **Why TrueMap?** OnX is expensive and limiting. I wanted something where you can map your property in depth, track every hunt, analyze terrain, and create a "true map" of your land.

![TrueMap Screenshot](docs/screenshot.png)

## ✨ Features

- 🗺️ **Interactive 2D/3D Maps** - Satellite, topo, hillshade, and slope views
- 📍 **Comprehensive Tracking** - Hunts, sightings, trails, stands, blinds, animal sign
- 🌲 **Habitat Mapping** - Bedding areas, food sources, terrain features, thick cover
- 📥 **onX Import** - Import your existing onX Hunt data (KML/GPX exports)
- 🖼️ **Media Gallery** - Attach photos and videos to locations
- 📊 **Analytics** - Heatmaps and path density visualization
- 🔄 **Multi-Property** - Manage multiple properties in one project
- 💾 **Offline-First** - All data stored locally on your computer

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Git](https://git-scm.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/MattDougherty0/TrueMaps.git
cd TrueMaps

# Install dependencies
npm install

# Start the app
npm run dev
```

The app will open in a new window. That's it!

## 📦 Try the Sample Project

Want to explore with real data? Download our sample project with imported GPS tracks, stands, and terrain data.

### Download & Setup

1. **Download:** Go to [Releases](https://github.com/MattDougherty0/TrueMaps/releases) and download `sample-project.zip`
2. **Extract:** Unzip to a folder on your computer (e.g., `~/Documents/TrueMap-Sample/`)
3. **Open in TrueMap:** 
   - Launch the app with `npm run dev`
   - The sample project should load automatically, or click "Open Project" and select the extracted folder

### What's Included

The sample project contains:
- 🏔️ Two mapped properties with terrain analysis
- 🚶 24 GPS tracks from actual hunts
- 🎯 Stand locations and access routes
- 🌿 Bedding areas, food sources, and cover
- 📷 Trail camera photos and videos
- 🗺️ Hillshade, slope, and contour overlays

## 🆕 Creating Your Own Project

1. **New Project:** Click "New Project" in TrueMap
2. **Choose Location:** Select an empty folder for your project
3. **Add Property Boundary:**
   - Draw manually on the map, OR
   - Import from onX (export your property as KML)
4. **Start Mapping:** Add stands, trails, bedding areas, etc.

### Adding Terrain Tiles (Optional)

For hillshade, slope analysis, and contours:
- See [Terrain Setup Guide](docs/terrain.md) for instructions
- Requires downloading DEM data for your area

## 📥 Importing from onX Hunt

Already use onX? Import your existing data:

1. **Export from onX:** In onX Hunt app, go to **Markups → Export → KML** or **GPX**
2. **Import:** In TrueMap, click **Import → onX Data**
3. **Select File:** Choose your exported `.kml` or `.gpx` file
4. **Review:** Check the import summary and confirm

### What Gets Imported
- ✅ Waypoints and markers
- ✅ GPS tracks
- ✅ Shapes and areas
- ✅ Stand locations
- ❌ Photos (not included in onX exports)

## 📁 Project Structure

```
your-project/
├── project.json          # Project settings & properties
├── data/                 # GeoJSON feature data
│   ├── trails.geojson
│   ├── stands.geojson
│   ├── bedding_areas.geojson
│   └── ...
├── tiles/                # Map tiles (optional)
│   ├── aerial.mbtiles
│   ├── hillshade.mbtiles
│   └── ...
├── media/                # Photos and videos
└── exports/              # Exported maps and reports
```

## 🛠️ Development

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Build desktop app installer (requires native deps)
npm run build:app
```

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

**Built with:** React, TypeScript, OpenLayers, Cesium, Electron
