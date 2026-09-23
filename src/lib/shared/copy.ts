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
		emptyHint: 'Sobald du etwas planst, landet es hier auf deinem Board.',
		lanes: {
			short: 'Kurzfristig',
			mid: 'Mittelfristig',
			long: 'Langfristig'
		},
		laneEmpty: 'Hier ist gerade nichts.',
		allGoals: 'Alle Ziele',
		newGoal: 'Neues Ziel',
		newPostit: 'Neues Post-it',
		goalProgress: (percent: number) => `${percent} % geschafft`,
		overdueChip: 'verschoben?',
		doneSection: (count: number) => `Erledigt (${count})`,
		showDone: 'Erledigte anzeigen',
		hideDone: 'Erledigte ausblenden',
		cleanupButton: (count: number) => `Aufräumen (${count})`,
		cleanupTitle: 'Überfällige Post-its aufräumen',
		cleanupHint:
			'Diese Post-its liegen in der Vergangenheit. Wähle aus, was damit passieren soll.',
		cleanupSelectAll: 'Alle auswählen',
		cleanupApply: 'Anwenden',
		cleanupEmpty: 'Nichts Überfälliges — dein Board ist aufgeräumt.',
		cleanupActions: {
			today: 'Auf heute',
			plusWeek: 'Um 1 Woche verschieben',
			done: 'Erledigt',
			delete: 'Löschen'
		},
		actions: {
			markDone: 'Erledigt markieren',
			reopen: 'Wieder öffnen',
			edit: 'Bearbeiten',
			changeDate: 'Datum ändern',
			assignGoal: 'Ziel zuordnen',
			moveTo: 'Verschieben nach',
			delete: 'Löschen',
			openMenu: 'Aktionen'
		},
		form: {
			title: 'Titel',
			titlePlaceholder: 'Was steht an?',
			goalTitlePlaceholder: 'Worum geht es?',
			note: 'Notiz',
			notePlaceholder: 'Optionaler Kontext …',
			date: 'Datum',
			time: 'Uhrzeit',
			duration: 'Dauer in Minuten',
			goal: 'Ziel',
			noGoal: 'Kein Ziel',
			color: 'Farbe',
			colorGoal: 'Ziel-Farbe',
			targetDate: 'Zieldatum (optional)',
			emoji: 'Emoji (optional)',
			save: 'Speichern',
			create: 'Anlegen',
			cancel: 'Abbrechen'
		},
		colors: {
			butter: 'Butter',
			mint: 'Minze',
			sky: 'Himmel',
			blush: 'Blush',
			sand: 'Sand',
			sage: 'Salbei',
			lilac: 'Flieder'
		},
		toast: {
			done: 'Post-it erledigt',
			deleted: 'Post-it gelöscht',
			restored: 'Wiederhergestellt',
			goalDeleted: 'Ziel gelöscht',
			goalDone: 'Ziel erreicht — stark!',
			krDeleted: 'Key Result gelöscht',
			cleanedUp: (count: number) => `${count} Post-its aufgeräumt`,
			undo: 'Rückgängig',
			error: 'Das hat nicht geklappt — versuch es nochmal.'
		},
		goal: {
			back: 'Zurück zum Board',
			open: 'Ziel öffnen',
			progressTitle: 'Fortschritt',
			keyResults: 'Key Results',
			addKeyResult: 'Key Result hinzufügen',
			kindNumber: 'Zahl',
			kindCheck: 'Häkchen',
			startValue: 'Start',
			targetValue: 'Zielwert',
			currentValue: 'Aktuell',
			unit: 'Einheit (optional)',
			noKeyResults: 'Noch keine Key Results — optional, aber hilfreich.',
			linkedPostits: 'Verknüpfte Post-its',
			noLinkedPostits: 'Noch keine Post-its mit diesem Ziel verknüpft.',
			linkedHabits: 'Verknüpfte Habits',
			noSteps: 'Noch keine Schritte — verknüpfe Post-its oder lege Key Results an.',
			achievedTitle: 'Alles geschafft!',
			achievedQuestion: 'Als erreicht markieren?',
			achievedAction: 'Ziel erreicht',
			achievedLater: 'Noch nicht',
			status: 'Status',
			statuses: {
				active: 'Aktiv',
				done: 'Erreicht',
				archived: 'Archiviert'
			},
			editGoal: 'Ziel bearbeiten',
			deleteGoal: 'Ziel löschen',
			deleteKeyResult: 'Key Result löschen',
			notFound: 'Dieses Ziel gibt es nicht (mehr).'
		},
		errors: {
			dateInvalid: 'Bitte ein gültiges Datum wählen.',
			timeInvalid: 'Bitte eine gültige Uhrzeit (HH:MM) eingeben.',
			foreignRef: 'Dieses Ziel oder dieser Habit gehört nicht zu deinem Konto.'
		}
	},
	calendar: {
		title: 'Kalender',
		emptyTitle: 'Dein Kalender ist noch leer',
		emptyHint: 'Post-its mit Datum erscheinen hier ganz von selbst.',
		views: {
			week: 'Woche',
			month: 'Monat'
		},
		viewLabel: 'Ansicht',
		previous: 'Zurück',
		next: 'Weiter',
		todayButton: 'Heute',
		dayEmpty: '—',
		moreInDay: (count: number) => `+${count} mehr`,
		dayPostits: (day: string) => `Post-its am ${day}`,
		// SPEC 8.4: tapping a post-it in the calendar opens the edit sheet.
		editTitle: 'Post-it bearbeiten',
		habitsTitle: 'Habits',
		habitsEmpty: 'Noch keine Habits — leg dein erstes an.',
		habitsArchived: 'Archivierte Habits',
		newHabit: 'Neues Habit',
		editHabit: 'Habit bearbeiten',
		openMenu: 'Aktionen',
		archive: 'Archivieren',
		unarchive: 'Wieder aktivieren',
		deleteHabit: 'Habit löschen',
		progressCount: (count: number, target: number) => `${count} von ${target}`,
		// P3: completed windows, never a streak. The value never sinks.
		periodsDone: {
			week: (count: number) => `Wochen geschafft: ${count}`,
			month: (count: number) => `Monate geschafft: ${count}`,
			range: (count: number) => `Wochen geschafft: ${count}`
		},
		bestWeek: (count: number) => `Beste Woche: ${count}`,
		bestMonth: (count: number) => `Bester Monat: ${count}`,
		windowLabel: (from: string, to: string) => `${from} – ${to}`,
		// SPEC 5.5 pace text, `range` habits only. Sage for good news, sand
		// for the neutral rest — never red.
		pace: {
			upcoming: (date: string) => `Startet am ${date}.`,
			achieved: 'Geschafft 🎉',
			expired: (count: number, target: number) => `Zeitraum vorbei: ${count} von ${target} — stark!`,
			onTrack: 'Du liegst im Plan.',
			behind: (remaining: number, perWeek: number) =>
				`Noch ${remaining} bis zum Ziel — etwa ${perWeek} pro Woche.`
		},
		log: {
			add: 'Heute eintragen',
			remove: 'Letzten Eintrag von heute zurücknehmen',
			count: (count: number) => `${count}× heute`,
			limitReached: 'Maximum für heute erreicht',
			saved: 'Eingetragen',
			removed: 'Eintrag zurückgenommen',
			error: 'Das hat nicht geklappt — versuch es nochmal.',
			errors: {
				future: 'Dieses Datum liegt in der Zukunft.',
				tooOld: 'Das liegt mehr als 60 Tage zurück.',
				outsideRange: 'Dieser Tag liegt außerhalb des Zeitraums.',
				maxPerDay: 'Maximum für heute erreicht',
				noLog: 'Für diesen Tag gibt es nichts zurückzunehmen.'
			}
		},
		form: {
			title: 'Titel',
			titlePlaceholder: 'z. B. Laufen',
			emoji: 'Emoji (optional)',
			color: 'Farbe',
			cadence: 'Rhythmus',
			cadences: {
				week: 'Pro Woche',
				month: 'Pro Monat',
				range: 'Fester Zeitraum'
			},
			targetCount: 'Ziel-Anzahl',
			rangeStart: 'Zeitraum von',
			rangeEnd: 'Zeitraum bis',
			maxPerDay: 'Maximum pro Tag',
			goal: 'Ziel (optional)',
			noGoal: 'Kein Ziel',
			save: 'Speichern',
			create: 'Anlegen',
			cancel: 'Abbrechen',
			deleteHint: 'Löschen entfernt das Habit samt seiner Einträge.'
		},
		errors: {
			rangeRequired: 'Für einen festen Zeitraum brauchst du Start und Ende.',
			targetInvalid: 'Bitte eine Zahl zwischen 1 und 10000.',
			maxPerDayInvalid: 'Bitte eine Zahl zwischen 1 und 20.'
		},
		toast: {
			created: 'Habit angelegt',
			updated: 'Habit gespeichert',
			archived: 'Habit archiviert',
			unarchived: 'Habit wieder aktiv',
			deleted: 'Habit gelöscht',
			postitSaved: 'Post-it gespeichert'
		}
	},
	capture: {
		fabLabel: 'Schnell erfassen',
		sidebarPlaceholder: 'Was steht an? (Enter für Quick Capture)',
		sidebarSubmit: 'Erfassen',
		title: 'Quick Capture',
		inputLabel: 'Was steht an?',
		inputPlaceholder: 'z. B. Montag Sport, Dienstag und Mittwoch lernen',
		send: 'Erstellen',
		loading: 'Einen Moment — dein Text wird sortiert …',
		consentTitle: 'KI-Erkennung erlauben?',
		// SPEC 9.5 consent text; the provider name comes from the server
		// (LLM_PROVIDER_NAME). '**' marks the bold part, rendered without HTML.
		consentText: (provider: string) =>
			`Dein Text wird zur Verarbeitung an einen externen KI-Anbieter (${provider}) gesendet, um Post-its zu erstellen. Journal-Einträge sind davon **nie** betroffen.`,
		consentAllow: 'Erlauben',
		consentDecline: 'Ohne KI nutzen',
		previewHint: 'Prüfe die Zeilen — du kannst jede anpassen oder entfernen.',
		fallbackHint:
			'Automatische Erkennung war gerade nicht möglich — dein Text wurde als Post-it übernommen.',
		limitReached:
			'Für heute ist das Tageslimit erreicht — dein Text wird ohne KI als Post-it gespeichert.',
		rowTitle: 'Titel',
		rowDate: 'Datum',
		rowTime: 'Uhrzeit (optional)',
		removeRow: 'Zeile entfernen',
		goalChip: (title: string) => `Ziel: ${title}`,
		habitChip: (title: string) => `Habit: ${title}`,
		apply: 'Übernehmen',
		created: (count: number) =>
			count === 1 ? '1 Post-it erstellt' : `${count} Post-its erstellt`,
		undo: 'Rückgängig',
		error: 'Das hat nicht geklappt — versuch es nochmal.',
		settingsTitle: 'KI-Erkennung',
		settingsHint:
			'Wenn aktiv, wird dein Capture-Text zur Erkennung an den KI-Anbieter gesendet. Aus bedeutet: jeder Text wird unverändert als Post-it gespeichert. Journal-Einträge sind davon nie betroffen.',
		settingsToggle: 'KI-Erkennung aktiv',
		settingsSaved: 'Gespeichert.'
	},
	journal: {
		title: 'Journal',
		emptyTitle: 'Noch keine Einträge',
		emptyHint: 'Dein erster Journal-Eintrag wartet schon auf dich.',
		// SPEC 8.5: the in-app reminder is the "Heute" card with one large
		// friendly button per due template.
		todayTitle: 'Heute',
		todayEmpty: 'Gerade ist nichts fällig — schreib, wenn dir danach ist.',
		dueLabel: 'Wartet auf dich',
		fillNow: 'Ausfüllen',
		backfill: 'Nachtragen',
		backfillTitle: 'Eintrag nachtragen',
		backfillHint: 'Wähle eine Vorlage und den Tag, für den du schreiben willst.',
		historyTitle: 'Verlauf',
		historyLimited: (days: number) => `Verlauf der letzten ${days} Tage.`,
		openEntry: 'Eintrag öffnen',
		entryNewTitle: 'Neuer Eintrag',
		entryEditTitle: 'Eintrag bearbeiten',
		entrySlot: (time: string) => `${time} Uhr`,
		entryNoSlot: 'Ohne Uhrzeit',
		// AC14: deactivated templates keep their entries readable.
		entryInactiveTemplate: 'Vorlage deaktiviert',
		entrySnapshotHint:
			'Diese Vorlage wurde später geändert oder deaktiviert — der Eintrag zeigt den Stand von damals.',
		templatesButton: 'Vorlagen',
		templatesTitle: 'Vorlagen verwalten',
		templatesEmpty: 'Noch keine Vorlagen — leg deine erste an.',
		newTemplate: 'Neue Vorlage',
		editTemplate: 'Vorlage bearbeiten',
		templateInactive: 'deaktiviert',
		deactivate: 'Deaktivieren',
		activate: 'Aktivieren',
		deactivateHint:
			'Deaktivierte Vorlagen erscheinen nicht mehr in „Heute“ — bestehende Einträge bleiben lesbar.',
		noSchedule: 'Nur manuell',
		emptyValue: '—',
		form: {
			date: 'Datum',
			slot: 'Uhrzeit',
			slotNone: 'Ohne Uhrzeit',
			name: 'Name',
			namePlaceholder: 'z. B. Abendreflexion',
			emoji: 'Emoji (optional)',
			active: 'Aktiv',
			schedule: 'Zeitplan',
			scheduleManualHint:
				'Ohne Zeitplan erscheint die Vorlage nicht in „Heute“ — du kannst sie jederzeit manuell ausfüllen.',
			scheduleToggle: 'Erinnerung in „Heute“ anzeigen',
			times: 'Uhrzeiten',
			addTime: 'Uhrzeit hinzufügen',
			removeTime: 'Uhrzeit entfernen',
			days: 'Wochentage',
			fields: 'Felder',
			addField: 'Feld hinzufügen',
			removeField: 'Feld entfernen',
			fieldType: 'Feldtyp',
			fieldLabel: 'Beschriftung',
			fieldLabelPlaceholder: 'z. B. Stimmung',
			required: 'Pflichtfeld',
			scaleMax: 'Skala bis',
			scaleStyle: 'Darstellung',
			placeholder: 'Platzhalter',
			maxLength: 'Maximale Zeichen',
			options: 'Optionen',
			addOption: 'Option hinzufügen',
			removeOption: 'Option entfernen',
			unit: 'Einheit',
			minValue: 'Minimum',
			maxValue: 'Maximum',
			save: 'Speichern',
			create: 'Anlegen',
			cancel: 'Abbrechen',
			requiredMark: 'Pflichtfeld'
		},
		types: {
			scale: 'Skala',
			text: 'Text',
			yesno: 'Ja/Nein',
			choice: 'Auswahl',
			number: 'Zahl'
		},
		scaleStyles: {
			faces: 'Gesichter',
			numbers: 'Zahlen'
		},
		days: {
			0: 'So',
			1: 'Mo',
			2: 'Di',
			3: 'Mi',
			4: 'Do',
			5: 'Fr',
			6: 'Sa'
		},
		faceLabels: {
			1: 'sehr schlecht',
			2: 'eher schlecht',
			3: 'mittel',
			4: 'eher gut',
			5: 'sehr gut'
		},
		values: {
			yes: 'Ja',
			no: 'Nein',
			counter: (length: number, max: number) => `${length} / ${max} Zeichen`,
			decrease: 'Verringern',
			increase: 'Erhöhen'
		},
		toast: {
			entryCreated: 'Eintrag gespeichert',
			entrySaved: 'Eintrag gespeichert',
			templateCreated: 'Vorlage angelegt',
			templateSaved: 'Vorlage gespeichert',
			templateDeactivated: 'Vorlage deaktiviert',
			templateActivated: 'Vorlage aktiviert',
			error: 'Das hat nicht geklappt — versuch es nochmal.'
		},
		errors: {
			// Schema-level messages (SPEC 5.7 bounds).
			fieldIdInvalid: 'Feld-Kennung: Buchstaben, Zahlen, _ und - (max. 40 Zeichen).',
			fieldIdDuplicate: 'Jede Feld-Kennung darf nur einmal vorkommen.',
			facesRange: 'Gesichter gibt es nur bei einer Skala bis 5.',
			optionsDuplicate: 'Jede Option darf nur einmal vorkommen.',
			boundsInvalid: 'Das Maximum muss über dem Minimum liegen.',
			timesDuplicate: 'Jede Uhrzeit darf nur einmal vorkommen.',
			daysDuplicate: 'Jeder Wochentag darf nur einmal vorkommen.',
			timesNeedDays: 'Wähle mindestens einen Wochentag für die Uhrzeiten.',
			tooManyValues: 'Zu viele Werte im Eintrag.',
			// Value validation against fields_snapshot.
			unknownField: 'Dieses Feld gehört nicht zu dieser Vorlage.',
			required: 'Dieses Feld ist ein Pflichtfeld.',
			notANumber: 'Bitte eine Zahl eingeben.',
			outOfScale: 'Dieser Wert liegt außerhalb der Skala.',
			notBoolean: 'Bitte Ja oder Nein wählen.',
			notInOptions: 'Bitte eine der Optionen wählen.',
			textTooLong: 'Der Text ist zu lang.',
			outOfBounds: 'Dieser Wert liegt außerhalb des erlaubten Bereichs.',
			invalidValue: 'Dieser Wert passt nicht zum Feldtyp.',
			// API errors.
			templateUnknown: 'Diese Vorlage gibt es nicht (mehr).',
			slotTaken:
				'Für diese Vorlage gibt es zu dieser Uhrzeit schon einen Eintrag — bearbeite den bestehenden.',
			futureDate: 'Nachtragen geht nur für heute oder früher.',
			templateInactive: 'Diese Vorlage ist deaktiviert — aktiviere sie zuerst.'
		}
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
	toast: {
		close: 'Schließen'
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
