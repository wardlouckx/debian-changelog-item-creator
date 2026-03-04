const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const debianChangelogLineRegex = /^(.*?) \((.*?)\) (.*?); urgency=(.*?)$/

	const editEmailAddress = vscode.commands.registerCommand(
		"debian-changelog-item-creator.editEmailAddress",
		async () => {
			if (!isDebianChangelogFileActive()) {
				return;
			}
			await promptForEmail();
		},
	);

	const editName = vscode.commands.registerCommand(
		"debian-changelog-item-creator.editName",
		async () => {
			if (!isDebianChangelogFileActive()) {
				return;
			}
			await promptForName();
		},
	);

	const newChangelogItem = vscode.commands.registerCommand(
		"debian-changelog-item-creator.newChangelogItem",
		async () => {
			if (!isDebianChangelogFileActive()) {
				return;
			}
			const config = vscode.workspace.getConfiguration("debian-changelog-item-creator");
			let name = config.get("name");
			let email = config.get("emailAddress");

			if (!name) {
				name = await promptForName();
			}

			if (!email) {
				email = await promptForEmail();
			}

			if (!name || !email) {
				vscode.window.showErrorMessage(
					"Debian Changelog Item Creator: Name or Email is not set.",
				);
				return;
			}

			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const changelogLine = findChangelogLine(editor);
				if (!changelogLine) {
					vscode.window.showWarningMessage(
						"Debian Changelog Item Creator: No changelog line found below the cursor. Added a default changelog item instead.",
					);
				}

				const { title, version, distribution, urgency } = parseChangelogLine(changelogLine);
				const newVersion = bumpVersion(version);
				let changelogMessage = "";

				// Check if there is selected text
				const selection = editor.selection;
				if (!selection.isEmpty) {
					changelogMessage = editor.document.getText(selection);
					// Remove the selected text
					await editor.edit((editBuilder) => {
						editBuilder.delete(selection);
					});
				} else {
					// Check if the cursor is at the end of a line with text
					const cursorPosition = editor.selection.active;
					const lineText = editor.document.lineAt(cursorPosition.line).text;
					if (cursorPosition.character === lineText.length) {
						changelogMessage = lineText.trim();
						// Remove the line text
						await editor.edit((editBuilder) => {
							editBuilder.delete(
								new vscode.Range(
									cursorPosition.line,
									0,
									cursorPosition.line,
									lineText.length,
								),
							);
						});
					}
				}

				// Format the changelog message with indentation and bullet points
				const formattedChangelogMessage = changelogMessage
					.split("\n")
					.map((line) => `    - ${line.trim()}`)
					.join("\n");

				// Function to format the date string in the desired format
				const formatDate = (date) => {
					const options = {
						weekday: "short",
						day: "2-digit",
						month: "short",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit",
						timeZoneName: "short",
						hour12: false,
					};

					const formatter = new Intl.DateTimeFormat("en-US", options);

					const parts = formatter.formatToParts(date).reduce((acc, part) => {
						acc[part.type] = part.value;
						return acc;
					}, {});

					const day = parts.day.padStart(2, "0");
					const month = parts.month;
					const year = parts.year;
					const weekday = parts.weekday;
					const hour = parts.hour.padStart(2, "0");
					const minute = parts.minute.padStart(2, "0");
					const second = parts.second.padStart(2, "0");
					const timeZoneOffset = date.toString().match(/([+-][0-9]{4})/)[1];

					return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} ${timeZoneOffset}`;
				};

				const currentDate = new Date();
				const formattedDate = formatDate(currentDate);

				const template = `${title} (${newVersion}) ${distribution}; urgency=${urgency}\n\n  * Change: \n\n -- ${name} <${email}> ${formattedDate}`; // Using normal spaces instead of tabs to prevent issues with syntax highlighting and positioning

				await editor.edit((editBuilder) => {
					editBuilder.insert(editor.selection.active, template);
				});

				// Ensure there's a newline at the top and bottom of the newly inserted changelog item
				const position = editor.selection.active;
				let startLine = position.line - template.split("\n").length + 1;
				const endLine = position.line;

				await editor
					.edit((editBuilder) => {
						// Check and add newline at the top
						if (
							startLine > 0 &&
							editor.document.lineAt(startLine - 1).text.trim() !== ""
						) {
							editBuilder.insert(new vscode.Position(startLine, 0), "\n");
							startLine++;
						}
						// Check and add newline at the bottom
						if (
							endLine < editor.document.lineCount - 1 &&
							editor.document.lineAt(endLine + 1).text.trim() !== ""
						) {
							editBuilder.insert(new vscode.Position(endLine + 1, 0), "\n");
						}
					})
					.then(() => {
						// Move the cursor to the startLine after the edit
						const newPosition = new vscode.Position(startLine, 0);
						editor.selection = new vscode.Selection(newPosition, newPosition);
						editor.revealRange(new vscode.Range(newPosition, newPosition));
					});

				if (!changelogMessage) {
					// Place the cursor at the position of changelogMessage
					const newPosition = new vscode.Position(startLine + 4, 6);
					editor.selection = new vscode.Selection(newPosition, newPosition);
					editor.revealRange(new vscode.Range(newPosition, newPosition));
				}
			} else {
				vscode.window.showErrorMessage(
					"Debian Changelog Item Creator: No active text editor found.",
				);
			}
		},
	);

	const updateChangelogDate = vscode.commands.registerCommand(
		"debian-changelog-item-creator.updateChangelogDate",
		async () => {
			if (!isDebianChangelogFileActive()) {
				return;
			}
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const document = editor.document;
				const cursorPosition = editor.selection.active;

				// Find the start of the changelog item
				let startLine = cursorPosition.line;
				while (
					startLine >= 0 &&
					!document.lineAt(startLine).text.match(debianChangelogLineRegex)
				) {
					startLine--;
				}

				// Find the end of the changelog item
				let endLine = cursorPosition.line;
				while (
					endLine < document.lineCount &&
					!document.lineAt(endLine).text.startsWith("    -- ")
				) {
					endLine++;
				}

				if (startLine < 0 || endLine >= document.lineCount) {
					vscode.window.showErrorMessage(
						"Debian Changelog Item Creator: Could not find the changelog item boundaries.",
					);
					return;
				}

				// Format the current date
				const currentDate = new Date();
				const formattedDate = formatDate(currentDate);

				// Extract the author and email from the end line
				const endLineText = document.lineAt(endLine).text;
				const authorEmailMatch = endLineText.match(/-- (.*) <(.*)>/);
				if (!authorEmailMatch) {
					vscode.window.showErrorMessage(
						"Debian Changelog Item Creator: Could not extract author and email information.",
					);
					return;
				}
				const author = authorEmailMatch[1];
				const email = authorEmailMatch[2];

				// Replace the date in the changelog item
				const range = new vscode.Range(
					new vscode.Position(endLine, 0),
					new vscode.Position(endLine, document.lineAt(endLine).text.length),
				);

				const newLineText = `    -- ${author} <${email}> ${formattedDate}`;

				await editor.edit((editBuilder) => {
					editBuilder.replace(range, newLineText);
				});

				vscode.window.showInformationMessage("Changelog date updated successfully!");
			} else {
				vscode.window.showErrorMessage(
					"Debian Changelog Item Creator: No active text editor found.",
				);
			}
		},
	);

	context.subscriptions.push(newChangelogItem);
	context.subscriptions.push(editEmailAddress);
	context.subscriptions.push(editName);
	context.subscriptions.push(updateChangelogDate);

	let isInsertingDash = false; // Flag to prevent re-triggering
	let previousCursorPosition = null; // Track the previous cursor position

	// Listen for selection changes to handle the Enter key behavior
	vscode.window.onDidChangeTextEditorSelection((event) => {
		if (!isDebianChangelogFileActive()) {
			return;
		}

		const editor = event.textEditor;
		const document = editor.document;
		const cursorPosition = editor.selection.active;

		if (
			previousCursorPosition &&
			cursorPosition.line !== previousCursorPosition.line &&
			!isInsertingDash
		) {
			const previousLineText = document.lineAt(previousCursorPosition.line).text;
			const currentLineText = document.lineAt(cursorPosition.line).text;
			const trimmedLineText = previousLineText.trim();

			// Check if the previous line starts with "-" (but not "--") and the current line starts with 4 spaces or a tab
			if (
				trimmedLineText.startsWith("-") &&
				!trimmedLineText.startsWith("--") &&
				!trimmedLineText.startsWith("*") &&
				(currentLineText.startsWith("    ") || currentLineText.startsWith("\t")) &&
				!currentLineText.trim().startsWith("-") &&
				currentLineText.trim() === "" // Ensure the current line is empty or only contains whitespace
			) {
				isInsertingDash = true; // Set the flag to prevent re-triggering

				editor
					.edit((editBuilder) => {
						editBuilder.insert(cursorPosition, "- ");
					})
					.then(() => {
						isInsertingDash = false; // Reset the flag after insertion
					});
			}
		}

		// Update the previous cursor position
		previousCursorPosition = cursorPosition;
	});

	// Listen for text changes to handle the Tab key behavior
	vscode.workspace.onDidChangeTextDocument((event) => {
		// console.log("onDidChangeTextDocument triggered");
		if (!isDebianChangelogFileActive()) {
			// console.log("Not a Debian changelog file");
			return;
		}

		const editor = vscode.window.activeTextEditor;
		if (!editor || event.document !== editor.document) {
			// console.log("No active editor or wrong document");
			return;
		}

		const changes = event.contentChanges;
		// console.log("Changes:", JSON.stringify(changes));
		if (changes.length === 1) {
			const cursorPosition = editor.selection.active;
			const lineText = editor.document.lineAt(cursorPosition.line).text;
			// console.log("Current line text:", lineText);

			if (changes[0].text === "\t" || /^ {2,3}$/.test(changes[0].text)) {
				// console.log("Tab key pressed");
				const leadingWhitespace = lineText.match(/^\s*/)[0];
				// console.log("Leading whitespace:", leadingWhitespace);
				editor.edit((editBuilder) => {
					// console.log("Editing document");
					editBuilder.delete(
						new vscode.Range(
							cursorPosition.line,
							0,
							cursorPosition.line,
							lineText.length,
						),
					);
					const newText = lineText.trimLeft().startsWith("- ")
						? `    ${leadingWhitespace}- ${lineText.trim().substring(2)}`
						: `    ${leadingWhitespace}${lineText.trim()}`;
					// console.log("New text to insert:", newText);
					editBuilder.insert(new vscode.Position(cursorPosition.line, 0), newText);
				});
			}
		}
	});

	async function promptForName() {
		// Prompt the user to enter their name
		const name = await vscode.window.showInputBox({
			placeHolder: "Enter your name (Firstname Lastname)",
			prompt: "Please enter your name (Firstname Lastname)",
			validateInput: (text) => {
				return text.trim() === "" ? "Name cannot be empty or contain only spaces" : null;
			},
		});

		if (name && name.trim() !== "") {
			// Save the name in the global settings under debian-changelog-item-creator namespace
			const config = vscode.workspace.getConfiguration("debian-changelog-item-creator");
			await config.update("name", name.trim(), vscode.ConfigurationTarget.Global);

			vscode.window.showInformationMessage("Name saved successfully!");
		} else {
			vscode.window.showWarningMessage("Name input was cancelled.");
		}
		return name;
	}

	async function promptForEmail() {
		// Prompt the user to enter their email address
		const email = await vscode.window.showInputBox({
			placeHolder: "Enter your email address",
			prompt: "Please enter your email address",
			validateInput: (text) => {
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				return emailRegex.test(text) ? null : "Please enter a valid email address";
			},
		});

		if (email) {
			// Save the email address in the global settings under debian-changelog-item-creator namespace
			const config = vscode.workspace.getConfiguration("debian-changelog-item-creator");
			await config.update("emailAddress", email, vscode.ConfigurationTarget.Global);

			vscode.window.showInformationMessage("Email address saved successfully!");
		} else {
			vscode.window.showWarningMessage("Email address input was cancelled.");
		}
		return email;
	}

	function parseChangelogLine(line) {
		const match = line.match(debianChangelogLineRegex);

		if (match) {
			return {
				title: match[1],
				version: match[2],
				distribution: match[3],
				urgency: match[4],
			};
		}

		return {
			title: "projectName",
			version: "0.0.0",
			distribution: "stable", // Default to "stable" if not found
			urgency: "low", // Default to "low" if not found
		};
	}

	function findChangelogLine(editor) {
		const document = editor.document;
		const cursorPosition = editor.selection.active.line;

		for (let i = cursorPosition; i < document.lineCount; i++) {
			const lineText = document.lineAt(i).text;
			if (lineText.match(debianChangelogLineRegex)) {
				return lineText;
			}
		}

		return "";
	}

	function bumpVersion(version) {
		const parts = version.split(".").map(Number);
		parts[parts.length - 1]++;
		return parts.join(".");
	}

	function formatDate(date) {
		const options = {
			weekday: "short",
			day: "2-digit",
			month: "short",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			timeZoneName: "short",
			hour12: false,
		};

		const formatter = new Intl.DateTimeFormat("en-US", options);

		const parts = formatter.formatToParts(date).reduce((acc, part) => {
			acc[part.type] = part.value;
			return acc;
		}, {});

		const day = parts.day.padStart(2, "0");
		const month = parts.month;
		const year = parts.year;
		const weekday = parts.weekday;
		const hour = parts.hour.padStart(2, "0");
		const minute = parts.minute.padStart(2, "0");
		const second = parts.second.padStart(2, "0");
		const timeZoneOffset = date.toString().match(/([+-][0-9]{4})/)[1];

		return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second} ${timeZoneOffset}`;
	}

	function isDebianChangelogFileActive() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return false;
		}
		const document = editor.document;
		return document.fileName.endsWith("changelog");
	}
}

module.exports = {
	activate,
};
