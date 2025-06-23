## [0.1.7] - 2025-06-23
### Fixed
- Fixed an issue where no changelog item could be made when the urgency of the previous item was anything other than "low"

## [0.1.6] - 2024-09-08
### Added
- Changelog text with multiple indentation levels are now supported by pressing Tab when on a line with only a -
### Fixed
- Placing your cursor below the Release line, adding a tab and a space and spamming left mouse click would insert a -

## [0.1.5] - 2024-07-03
## Fixed
- Pressing enter on a line with -- inserts a - on the line below

## [0.1.4] - 2024-06-25
### Added
- Extension now activates on startup instead of needing to trigger a command to activate it
### Fixed
- handleEnterKey command was interfering with other operations which used the Enter key

## [0.1.3] - 2024-06-24
### Fixed
- Error "command 'debian-changelog-item-creator.handleEnterKey' not found" when using the enter key in certain situations inside and outside of the changelog file
- Cursor ended up at the wrong line when inserting a new changelog item with no whitespace below

## [0.1.2] - 2024-06-20
### Added
- Automatically adds a - if you press enter on a line where you put your changelog message

### Fixed
- Missing newline between the second to last and the last line of the changelog item

## [0.1.0] - 2024-06-19
### Added
- Ability to update the time of a changelog item to the current time (Shortcut: `Ctrl+Win+Alt+i` for Windows and `Ctrl+Option+Cmd+i` for MacOS)
- A new changelog item will automatically add a newline at the top and/or bottom if it wasn't present already to prevent crammed changelogs without proper spacing

## [0.0.4] - 2024-06-17
### Added
- Ability to create a changelog with multiple lines of bulletpoints when selecting multiple lines of text
- Distribution (like "stable", "beta", "alpha", etc.) being dynamically determined by the previous changelog item
## Changed
- Changed all tabs with 4 spaces to solve issues with indentation
- Removed regex from name registration

## [0.0.3] - 2024-06-14
### Changed
- Removed a keybind from package.json which would appear as a duplicate in the keyboard shortcut list

## [0.0.2] - 2024-06-13
### Changed
- Replaced tab (\t) with 4 spaces of the last line of a new changelog item so the syntax highlighting of the debian/changelog file would work correctly

## [0.0.1] - 2024-06-13
### Initial release
