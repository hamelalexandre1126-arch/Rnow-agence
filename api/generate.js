const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- PROMPT RNOW : LUXE, EMOJIS ET LISIBILITÉ ---
  const promptFinal = `
Tu es l'expert de l'agence de voyage Rnow. Crée un voyage d'exception pour : ${destination}.
Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.

CONSIGNES DE STYLE ET FORME (TRÈS IMPORTANT) :
- Écris de manière CHALEUREUSE et PROFESSIONNELLE (minuscules normales).
- Utilise des EMOJIS pertinents pour illustrer chaque section (ex: ✈️, 🏨, 🍴, 🌊).
- FAIS BEAUCOUP D'ESPACES entre les paragraphes pour que ce soit aéré.
- Les titres doivent être en MAJUSCULES mais sans symboles (pas de # ou *).
- INTERDICTION d'utiliser des astérisques (**) ou des dièses (#).

STRUCTURE (11 POINTS) :
1. Utilisation précise des infos client.
2. Organisation complète de A à Z.
3. Prix RÉELS et vérifiés pour le ${date}.
4. Programme JOUR PAR JOUR détaillé avec horaires.
5. Activités (noms, adresses, prix, sites officiels).
6. Transports locaux (lieux, tarifs, billets).
7. Hébergement (nom, adresse, points forts).
8. 1 restaurant authentique par jour avec spécialités.
9. Options d'assurances précises.
10. Location voiture (si utile).
11. Expérience clé en main.

Finis par une section "MES CONSEILS VOYAGES" avec des astuces d'expert.
  `;

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;

    // Nettoyage de sécurité pour les symboles résiduels
    textOutput = textOutput.replace(/\*\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
