import { env } from './env.js';

// Text blocks for /impressum and /datenschutz (SPEC 12). Both pages are
// clearly marked placeholders; the privacy text names the LLM provider and
// hosting country from the environment.

export interface LegalSection {
	heading: string;
	paragraphs: string[];
}

export interface LegalDoc {
	placeholderNotice: string;
	sections: LegalSection[];
}

const PLACEHOLDER_NOTICE =
	'⚠ Muster — vor Livegang durch echten Impressums-/Datenschutztext ersetzen, z. B. anwaltlich geprüft.';

export function impressum(): LegalDoc {
	return {
		placeholderNotice: PLACEHOLDER_NOTICE,
		sections: [
			{
				heading: 'Angaben gemäß § 5 TMG',
				paragraphs: [
					'Vorname Nachname\nMusterstraße 1\n12345 Musterstadt',
					`Betreiber dieser Installation von FlowBoard. Diese Seite wird selbst gehostet; der Speicherort befindet sich in ${env.HOSTING_COUNTRY}.`
				]
			},
			{
				heading: 'Kontakt',
				paragraphs: ['E-Mail: platzhalter@example.com']
			},
			{
				heading: 'Verantwortlich für den Inhalt',
				paragraphs: ['Vorname Nachname, Anschrift wie oben.']
			}
		]
	};
}

export function datenschutz(): LegalDoc {
	return {
		placeholderNotice: PLACEHOLDER_NOTICE,
		sections: [
			{
				heading: 'Welche Daten gespeichert werden',
				paragraphs: [
					'FlowBoard speichert deine Kontodaten (Benutzername, Passwort-Hash, Wiederherstellungs-Hash), deine Pläne (Ziele, Key Results, Post-its, Habits) und deine Journal-Einträge. Passwörter und Wiederherstellungs-Phrasen werden nur als kryptografischer Hash gespeichert, niemals im Klartext.'
				]
			},
			{
				heading: 'Verarbeitung durch einen KI-Anbieter',
				paragraphs: [
					`Nutzt du die Schnellerfassung (Quick Capture) mit KI-Unterstützung, wird der eingegebene Text zur Verarbeitung an einen externen KI-Anbieter gesendet: ${env.LLM_PROVIDER_NAME}. Es wird ausschließlich der rohe Eingabetext übertragen, keine weiteren Kontodaten. Du kannst die KI-Funktion jederzeit in den Settings deaktivieren; deine Eingaben werden dann nur lokal als Post-it gespeichert.`
				]
			},
			{
				heading: 'Journal-Daten',
				paragraphs: [
					'Deine Journal-Einträge verlassen dieses System nicht. Sie werden niemals an den KI-Anbieter oder andere Dritte übertragen.'
				]
			},
			{
				heading: 'Speicherort',
				paragraphs: [
					`Alle Daten liegen auf einem selbst betriebenen Server (eigene VPS) in ${env.HOSTING_COUNTRY}. Es findet keine Cloud-Speicherung bei Drittanbietern statt.`
				]
			},
			{
				heading: 'Deine Rechte',
				paragraphs: [
					'Du hast jederzeit das Recht auf Auskunft, Export und Löschung deiner Daten. Alle drei Möglichkeiten findest du direkt in der App unter Settings: „Daten exportieren" liefert dir eine JSON-Datei mit allen deinen Daten, „Konto löschen" entfernt dein Konto und alle zugehörigen Daten endgültig.'
				]
			}
		]
	};
}
