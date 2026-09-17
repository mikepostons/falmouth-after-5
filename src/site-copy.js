export const copyDefaults = {
 informationTitle: "A little more Falmouth.",
 informationBody: "Falmouth After Five brings local businesses together for First Friday offers. Discover somewhere new to eat, meet for a drink, shop locally and make an evening of the town.",
 informationGuide: "Browse the offers or explore the map. Select a business for its offer, conditions and directions. Check each venue’s offer times before visiting.",
 organiser: "Organised by Falmouth BID",
 informationCredit: "The project is organised by Falmouth BID. This map portal was developed by",
 campaignLabel: "Visit the campaign page",
 offersTitle: "Current offers",
 informationLabel: "Information",
 informationSubtitle: "About Falmouth After Five",
 submissionTitle: "Add your business",
 submissionSubtitle: "Take part in the next First Friday",
 submissionIntro: "Tell us about your business and offer. Fields marked * are required. You can check everything before sending.",
 cookieText: "We use essential cookies to make this site work. With your permission, we also use Google Analytics to understand how the map and offers are used.",
};
export const siteCopy = data => Object.fromEntries(Object.entries(copyDefaults).map(([key,value])=>[key,data?.settings?.[key] || value]));
