const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ text: "Erreur : La clé GEMINI_API_KEY n'est pas configurée sur Vercel." });
  }

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow.
Rédige un carnet direct, percutant, concis et aéré. Ne t'arrête jamais avant la fin du carnet.

STRUCTURE DU CARNET :

L'ESSENTIEL EN UN COUP D'ŒIL
Court paragraphe de 2-3 phrases résumant l'ambiance et la faisabilité pour ${destination}.

FICHE TECHNIQUE DU VOYAGE
- Budget : ${budget}€ au total (environ ${Math.round(budget/duree)}€/jour) en mode ${confort}.
- Trajet A/R : Trajet optimisé depuis ${depart || 'Paris'} vers ${destination}. [Réserver mon transport](https://www.skyscanner.fr)
- Hébergement sélectionné : Un établissement phare recommandé pour le séjour. [Réserver l'hôtel](https://www.booking.com)
- Déplacements locaux : Mode recommandé (transports en commun, vélo, taxi, marche).

MONUMENTS ET INCONTOURNABLES
Liste 2 ou 3 lieux majeurs :
- Nom du spot : Pourquoi y aller. [Réserver l'entrée](https://www.getyourguide.fr)

LES TABLES SÉLECTIONNÉES PAR RNOW
3 adresses recommandées :
- Nom de la table : Spécialité locale à tester.

PLANNING JOUR PAR JOUR (Du Jour 1 au Jour ${duree})
Pour chaque jour :
- JOUR X : Titre court
Matin : Activité principale.
Après-midi : Exploration ou visite. [Réserver l'activité](https://www.getyourguide.fr)
Transport du jour : Conseil de déplacement rapide.

LE CONSEIL RNOW
Donne une astuce d'initié très précise (horaire secret, pépite méconnue, astuce locale) pour valoriser l'expertise de l'agence.

RÈGLES D'ÉCRITURE :
- Pas de formatage Markdown agressif : AUCUN astérisque (*), AUCUN dièse (#), AUCUN texte en gras (**).
- Majuscule au début de chaque phrase.
- Phrases courtes pour garantir une génération rapide et complète.
  `;

  const promptFinal = type === "initial"
    ? `Génère l'intégralité du carnet de voyage pour ${duree} jours à ${destination}. ${instructionsRnow}`
    : `Itinéraire actuel : "${ancienItineraire}". Ajuste-le selon : "${feedback}". ${instructionsRnow}`;

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (listData.error) {
      return res.status(200).json({ text: "Erreur API : " + listData.error.message });
    }

    const validModel = listData.models?.find(m => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      m.name.includes("flash")
    ) || listData.models?.[0];

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
          temperature: 0.6, // Baisse de température pour une génération plus rapide et stable
          maxOutputTokens: 2500 
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ text: "Erreur génération : " + data.error.message });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return res.status(200).json({ text: "Génération interrompue. Réessayez." });
    }

    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(200).json({ text: "Erreur serveur : " + error.message });
  }
}
