# HuntMaps (True Map)

A web-first, open-source mapping application for hunters to track hunts, sightings, trails, terrain, and media. Built with React, TypeScript, Cesium, and OpenLayers.

## Features

- 🗺️ **Interactive 3D/2D Maps** - Powered by Cesium and OpenLayers
- 📍 **Hunt Tracking** - Record hunts, sightings, animal paths, and sign
- 🖼️ **Photo & Video Gallery** - Attach media to locations and features
- 📊 **Analytics** - Heatmaps and path density visualization
- 🗺️ **Terrain Analysis** - Contours, hillshade, slope analysis
- 📤 **Export** - Export to GeoPackage, PDF, and more
- 📥 **Import** - Import onX Hunt data (KML/GPX)
- 🎨 **Customizable Layers** - Multiple layer types with styling options

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start web dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
HuntMaps/
├── src/              # React application source
│   ├── components/   # React components
│   ├── state/        # Zustand state management
│   ├── lib/          # Utilities and libraries
│   └── importers/    # Data importers (onX, etc.)
├── dist/             # Web build output
```

## Development

HuntMaps now runs entirely in the browser:

- Hosted terrain/imagery basemaps (USGS, Esri, OpenTopoMap)
- Projects saved in the browser (IndexedDB/local storage)
- Service worker caching for faster tile loads
- Optional MBTiles upload override (for custom terrain layers)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Roadmap

- [ ] Share/export/import browser projects
- [ ] Optional cloud sync
- [ ] Multi-user collaboration
- [ ] Additional basemap overlays (public land, weather, etc.)

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## Acknowledgments

Built with:
- [Cesium](https://cesium.com/) - 3D globe and map engine
- [OpenLayers](https://openlayers.org/) - 2D map library
- [React](https://react.dev/) - UI framework
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Vite](https://vitejs.dev/) - Build tool

