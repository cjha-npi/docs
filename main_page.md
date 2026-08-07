# NPI Main Project

This is the main documentation for the **NPI main project structure**.

## Requirements

- **OS:** Windows 10 or newer (x64)
- **IDE:** Microsoft Visual Studio Community 2022 or later
- **Framework:** Qt 6.8.x (MSVC 64-bit)
- **Language Standard:** C++20

## Coding Conventions

- **Everything** has to be inside either named or anonymous namespace.
- **NO** single word simple names e.g. `Font`, `Show`, etc. for **Class** and **Struct**.
- All **member variables** and **member functions** end with an underscore `_`.
- **Static members** and **static functions** start with a capital letter.
- **Comments:**
  - ASCII-only (no Unicode symbols or smart quotes)
  - Use `\brief` and `\details` for Doxygen descriptions
  - Use `/** ... */` for files, classes, structs, etc.
  - Use `///` for functions
  - Use `///<` for single-line member documentation
  - No Doxygen comments inside function bodies

## License

All rights reserved by **npi electronics GmbH**.  
Use restricted to internal development and testing purposes.