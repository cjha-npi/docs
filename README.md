# Main Project Documentation

This is the main documentation for the **NPI main project structure**.

## Current Components

- **Platform Check Utility** — Compile-time guard ensuring Windows-only builds.
- **OrgMetaData** — Organization metadata container having static constexpr members.
- **AppMetaData** — Application metadata container having static constexpr members.
- **nativeFatalMessage Utility** — Emergency startup fatal error message box when `QApplication` may not be available.
- **Meta Paths Utility** — Provides Organization and Application meta paths in ProgramData and Public/Documents directories.
- **GlobalLocker** — RAII wrapper around a Windows named mutex for both inter-process and inter-thread synchronization.
- **Concepts Page** — Contains reusable C++20 concepts that enforce design constraints.
- **GuiProps Struct** — Defines Qt property names used by custom `QProxyStyle` and widget rendering logic.
- **StageWindow Class** — Provides controlled show/hide animations for Qt widgets with opacity handling and optional timing customization.
- **TextSpec Class** — Manages thread-safe font creation and caching for consistent application typography.
- **RefPtr Classes** — Implements a non-owning, auto-nullifying linking mechanism (similar to `QPointer` + `std::shared_ptr`) for observer-style object tracking.

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