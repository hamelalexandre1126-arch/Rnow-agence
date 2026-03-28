const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'expert de l'agence Rnow. Crée un voyage d'exception pour : ${destination}.
Départ: ${depart} | Budget: ${budget}€ | Style: ${style} | Date: ${date} | Rythme: ${rythme}.

CONSIGNES DE STYLE ET FORME (CRUCIAL) :
- Écris avec enthousiasme, élégance et chaleur. Donne envie !
- Utilise des EMOJIS premium et pertinents pour illustrer CHAQUE info (ex: ✈️, 🏨, 🍴, 🌊, 📍, ✨, 🌅).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre les paragraphes pour une lecture fluide.
- INTERDICTION d'utiliser des astérisques (**) ou des dièses (#).

STRUCTURE DE LA SECTION VOLS (À RESPECTER SCRUPULEUSEMENT) :
Commence par : ✈️ TES VOLS SUR-MESURE.
Puis détaille ainsi, AVEC UN SAUT DE LIGNE ENTRE CHAQUE LIGNE :
🛫 ALLER [Date] :
[Emoji Compagnie] [Nom de la compagnie]
📍 Départ : ${depart} ([Code Aéroport]) à [Heure]
🛑 Escale : [Ville Escale] ([Code]) de [Durée Escale]
📍 Arrivée : ${destination} ([Code Aéroport]) à [Heure]
🛬 RETOUR [Date] :
[Emoji Compagnie] [Nom de la compagnie]
📍 Départ : ${destination} ([Code Aéroport]) à [Heure]
📍 Arrivée : ${depart} ([Code Aéroport]) à [Heure]
(Fais de même pour les escales du retour).

SUITE DU PROGRAMME (11 POINTS) :
[Reste de tes 11 points détaillés...]

Finis par : 💡 LE CONSEIL D'INITIÉ (Une astuce locale que personne ne connaît).
  `;

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;

    // Nettoyage de sécurité
    textOutput = textOutput.replace(/\*\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
