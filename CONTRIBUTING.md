# Contributing to HuntMaps

Thank you for your interest in contributing to HuntMaps! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported
2. Use a clear, descriptive title
3. Provide steps to reproduce
4. Include expected vs actual behavior
5. Add screenshots if applicable
6. Include environment details (OS, Node version, etc.)

### Suggesting Features

1. Check if the feature has already been suggested
2. Use a clear, descriptive title
3. Explain the use case and benefits
4. Consider implementation complexity
5. Be open to discussion and alternatives

### Pull Requests

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/HuntMaps.git
   cd HuntMaps
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow the existing code style
   - Add tests if applicable
   - Update documentation as needed
   - Keep commits focused and atomic

4. **Test Your Changes**
   ```bash
   npm run dev        # Test desktop version
   npm run build      # Ensure build succeeds
   ```

5. **Commit**
   - Use clear, descriptive commit messages
   - Reference issues when applicable: `Fixes #123`

6. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a pull request on GitHub

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

### File Structure

- Components in `src/components/`
- State management in `src/state/`
- Utilities in `src/lib/`
- Types in `src/types/`

### Testing

- Test your changes manually
- Ensure both desktop and web modes work
- Test edge cases and error handling

### Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update this file if contributing process changes

## Platform Considerations

This project supports both Electron (desktop) and web platforms. When making changes:

- **Use the platform abstraction layer** - Don't call `window.api` directly
- **Test on both platforms** - Ensure features work in both modes
- **Consider browser limitations** - Some features may need platform-specific implementations

## Questions?

Feel free to open an issue with the `question` label or reach out to maintainers.

Thank you for contributing! 🎉

