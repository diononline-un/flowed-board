// All user-visible texts live here (SPEC 0.7): German, Du-Form.
// Code, identifiers and comments stay English.

export const copy = {
	appName: 'FlowBoard',
	nav: {
		plans: 'Pläne',
		calendar: 'Kalender',
		journal: 'Journal',
		settings: 'Settings'
	},
	plans: {
		title: 'Pläne',
		emptyTitle: 'Noch keine Post-its',
		emptyHint: 'Sobald du etwas planst, landet es hier auf deinem Board.'
	},
	calendar: {
		title: 'Kalender',
		emptyTitle: 'Dein Kalender ist noch leer',
		emptyHint: 'Post-its mit Datum erscheinen hier ganz von selbst.'
	},
	journal: {
		title: 'Journal',
		emptyTitle: 'Noch keine Einträge',
		emptyHint: 'Dein erster Journal-Eintrag wartet schon auf dich.'
	},
	settings: {
		title: 'Settings',
		emptyTitle: 'Noch nichts einzustellen',
		emptyHint: 'Sobald dein Konto steht, findest du hier deine Optionen.',
		account: {
			profileTitle: 'Profil',
			displayName: 'Anzeigename',
			timezone: 'Zeitzone',
			timezoneHint: 'Zum Beispiel Europe/Berlin.',
			weekStart: 'Wochenstart',
			weekDays: {
				0: 'Sonntag',
				1: 'Montag',
				6: 'Samstag'
			},
			save: 'Speichern',
			saved: 'Gespeichert.',
			passwordTitle: 'Passwort ändern',
			passwordHint: 'Danach bleibst du nur auf diesem Gerät angemeldet.',
			currentPassword: 'Aktuelles Passwort',
			newPassword: 'Neues Passwort',
			changePassword: 'Passwort ändern',
			passwordChanged: 'Passwort geändert — alle anderen Sitzungen wurden abgemeldet.',
			recoveryBannerTitle: 'Phrase noch nicht bestätigt',
			recoveryBannerText:
				'Du hast deine Wiederherstellungs-Phrase noch nicht bestätigt. Ohne sie kommst du bei Passwort-Verlust nicht mehr rein.',
			recoveryBannerAction: 'Jetzt prüfen',
			recoveryTitle: 'Neue Phrase erzeugen',
			recoveryHint:
				'Gib dein Passwort ein, um eine neue Wiederherstellungs-Phrase zu erzeugen. Die alte wird dabei ungültig.',
			recoverySubmit: 'Neue Phrase erzeugen',
			sessionsTitle: 'Sitzungen',
			logout: 'Abmelden',
			logoutAll: 'Alle Sitzungen abmelden',
			logoutAllDone: 'Alle anderen Sitzungen wurden abgemeldet.',
			dataTitle: 'Deine Daten',
			dataText: 'Lade alle deine gespeicherten Daten als JSON-Datei herunter.',
			export: 'Daten exportieren',
			dangerTitle: 'Konto löschen',
			dangerText:
				'Löscht dein Konto und alle deine Daten endgültig. Das kann nicht rückgängig gemacht werden.',
			deleteButton: 'Konto löschen',
			deleteDialogTitle: 'Konto wirklich löschen?',
			deleteDialogText:
				'Gib zur Bestätigung deinen Benutzernamen und dein Passwort ein. Danach ist dein Konto unwiderruflich weg.',
			deleteConfirm: 'Konto endgültig löschen',
			passwordDialogText:
				'Bestätige die Passwortänderung. Alle anderen Sitzungen werden abgemeldet.',
			cancel: 'Abbrechen',
			confirm: 'Bestätigen',
			errors: {
				tzInvalid: 'Diese Zeitzone kennt das System nicht.',
				wrongPassword: 'Das Passwort stimmt nicht.',
				usernameMismatch: 'Der Benutzername stimmt nicht.'
			}
		}
	},
	auth: {
		username: 'Benutzername',
		password: 'Passwort',
		loginTitle: 'Willkommen zurück',
		loginSubtitle: 'Schön, dass du da bist.',
		loginSubmit: 'Anmelden',
		noAccount: 'Noch kein Konto?',
		registerLink: 'Jetzt registrieren',
		forgotLink: 'Passwort vergessen?',
		registerTitle: 'Konto erstellen',
		registerSubtitle: 'In einer Minute bist du startklar.',
		registerSubmit: 'Registrieren',
		haveAccount: 'Schon ein Konto?',
		loginLink: 'Zum Login',
		passwordHint: 'Tipp: 3–4 zufällige Wörter sind stark und leicht zu merken.',
		ageCheckbox: 'Ich bin mindestens 16 Jahre alt.',
		inviteCode: 'Einladungscode',
		recoverTitle: 'Konto wiederherstellen',
		recoverSubtitle: 'Mit deiner Phrase setzt du ein neues Passwort.',
		phraseLabel: 'Deine 12 Wörter',
		phraseHint: 'In der richtigen Reihenfolge, durch Leerzeichen getrennt.',
		newPassword: 'Neues Passwort',
		recoverSubmit: 'Passwort zurücksetzen',
		backToLogin: 'Zurück zum Login',
		errors: {
			invalidCredentials: 'Benutzername oder Passwort stimmt nicht.',
			recoverFailed: 'Angaben stimmen nicht.',
			rateLimited: 'Zu viele Versuche — bitte warte einen Moment.',
			registrationClosed: 'Die Registrierung ist gerade geschlossen.',
			usernameTaken: 'Dieser Benutzername ist schon vergeben.',
			inviteInvalid: 'Dieser Einladungscode stimmt nicht.',
			usernameInvalid:
				'3–24 Zeichen: kleine Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich — beginnend mit Buchstabe oder Zahl.',
			passwordTooShort: 'Mindestens 10 Zeichen.',
			passwordTooLong: 'Höchstens 128 Zeichen.',
			passwordIsUsername: 'Das Passwort darf nicht dein Benutzername sein.',
			passwordCommon: 'Dieses Passwort ist zu bekannt — wähle ein eigenes.',
			passwordRepeated: 'Nicht nur ein und dasselbe Zeichen wiederholen.',
			ageRequired: 'Bitte bestätige, dass du mindestens 16 Jahre alt bist.'
		}
	},
	recovery: {
		title: 'Deine Wiederherstellungs-Phrase',
		intro: 'Diese 12 Wörter ersetzen dein Passwort, wenn du es vergisst.',
		// SPEC 6.3a warning, verbatim wording.
		warning:
			'Ohne E-Mail können wir dein Passwort nicht zurücksetzen. Speichere diese 12 Wörter an einem sicheren Ort (Passwortmanager, Notizen-App mit Sperre oder Ausdruck). Wer sie hat, kann dein Konto übernehmen. Verlierst du Passwort und Phrase, ist dein Konto nicht wiederherstellbar.',
		copy: 'Kopieren',
		copied: 'Kopiert!',
		copyFailed: 'Kopieren nicht möglich — bitte markiere die Wörter selbst.',
		download: 'Als Datei speichern',
		downloadName: 'flowboard-recovery.txt',
		confirmStart: 'Phrase bestätigen',
		later: 'Später',
		confirmTitle: 'Kurz gegenchecken',
		confirmIntro:
			'Gib die gefragten Wörter ein — so weißt du, dass deine Sicherung funktioniert.',
		wordLabel: (position: number) => `Wort ${position}`,
		confirmWrong: 'Das stimmt leider nicht — prüfe die Wörter und versuch es nochmal.',
		confirmSubmit: 'Bestätigen',
		continue: 'Weiter'
	},
	legal: {
		impressumTitle: 'Impressum',
		datenschutzTitle: 'Datenschutz',
		placeholderBadge: 'Muster'
	},
	errors: {
		invalidBody: 'Ungültige Anfrage.',
		invalidInput: 'Bitte prüfe deine Eingaben.',
		unauthorized: 'Nicht angemeldet.',
		forbidden: 'Nicht erlaubt.',
		notFound: 'Nicht gefunden.',
		generic: 'Etwas ist schiefgelaufen — versuch es bitte nochmal.'
	}
} as const;
