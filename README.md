# Main Project Documentation

This is the main documentation for the **NPI main project structure**.

## Current Components

- **App Meta Data** — Provides organization and application metadata along with directory path utilities.
- **Windows Message Box Utility** — Lightweight wrapper around the native `MessageBoxW` API for displaying system message boxes.
- **Platform Check Utility** — Compile-time guard ensuring Windows-only builds.
- **Concepts Page** — Contains reusable C++20 concepts that enforce design constraints.
- **GuiProps Struct** — Defines Qt property names used by custom `QProxyStyle` and widget rendering logic.
- **Link Classes** — Implements a non-owning, auto-nullifying linking mechanism (similar to `QPointer` or weak references) for observer-style object tracking.
- **Font Class** — Manages thread-safe font creation and caching for consistent application typography.
- **Show Class** — Provides controlled show/hide animations for Qt widgets with opacity handling and optional timing customization.

## Requirements

- **OS:** Windows 10 or newer (x64)
- **IDE:** Microsoft Visual Studio Community 2022 or later
- **Framework:** Qt 6.8.x (MSVC 64-bit)
- **Language Standard:** C++20

## Project Structure
```
inc/npi/ -> Public headers under the npi namespace
src/ -> Source files
gui/ -> GUI-related resources
```

## Coding Conventions

- All **member variables** and **member functions** end with an underscore `_`.
- **Static members** and **static functions** start with a capital letter.
- **Comments:**
  - ASCII-only (no Unicode symbols or smart quotes)
  - Use `\brief` and `\details` for Doxygen descriptions
  - Use `/** ... */` for files, classes, structs, etc.
  - Use `///` for functions
  - Use `///<` for single-line member documentation
  - No Doxygen comments inside function bodies

## Documentation

This project uses **Doxygen** for code documentation.  
If used as the Doxygen main page, ensure the following in the Doxyfile:
```
USE_MDFILE_AS_MAINPAGE = README.md
```

## License

All rights reserved by **npi electronics GmbH**.  
Use restricted to internal development and testing purposes.