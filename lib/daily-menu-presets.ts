export const MENU_CATEGORY_OPTIONS = [
  { value: "Polevka", label: "Polévka" },
  { value: "Predkrm", label: "Předkrm" },
  { value: "Hlavni chod", label: "Hlavní chod" },
  { value: "Dezert", label: "Dezert" },
] as const;

export type MenuCategoryValue = (typeof MENU_CATEGORY_OPTIONS)[number]["value"];

export type DailyMenuPreset = {
  id: string;
  category: MenuCategoryValue;
  name: string;
  price: string;
  allergens?: string;
};

export const DAILY_MENU_PRESETS: DailyMenuPreset[] = [
  { id: "soup-vyvar", category: "Polevka", name: "Hovezi vyvar s nudlemi", price: "69 Kc", allergens: "1,3,9" },
  { id: "soup-kulajda", category: "Polevka", name: "Kulajda s vejcem", price: "79 Kc", allergens: "1,3,7" },
  { id: "soup-cesnecka", category: "Polevka", name: "Cesnecka se syrem a krutony", price: "75 Kc", allergens: "1,7" },
  { id: "starter-pastika", category: "Predkrm", name: "Domaci jatrova pastika s chlebem", price: "119 Kc", allergens: "1,7" },
  { id: "starter-hermelin", category: "Predkrm", name: "Nakladany hermelin", price: "115 Kc", allergens: "7" },
  { id: "main-svickova", category: "Hlavni chod", name: "Svíčková na smetaně, houskový knedlík", price: "239 Kc", allergens: "1,3,7,9,10" },
  { id: "main-gulas", category: "Hlavni chod", name: "Hovězí guláš, houskový knedlík", price: "229 Kc", allergens: "1,3" },
  { id: "main-rizek", category: "Hlavni chod", name: "Smažený kuřecí řízek, bramborový salát", price: "219 Kc", allergens: "1,3,7,10" },
  { id: "main-syr", category: "Hlavni chod", name: "Smažený sýr, hranolky, tatarská omáčka", price: "199 Kc", allergens: "1,3,7,10" },
  { id: "main-rizoto", category: "Hlavni chod", name: "Houbové rizoto s parmazánem", price: "189 Kc", allergens: "7" },
  { id: "main-kacena", category: "Hlavni chod", name: "Kachní stehno, zelí, bramborový knedlík", price: "269 Kc", allergens: "1,3" },
  { id: "main-file", category: "Hlavni chod", name: "Kuřecí steak, pepřová omáčka, americké brambory", price: "229 Kc", allergens: "7" },
  { id: "dessert-strudl", category: "Dezert", name: "Jablecny zavin se slehackou", price: "79 Kc", allergens: "1,3,7" },
  { id: "dessert-pala", category: "Dezert", name: "Palacinka s marmeladou a slehackou", price: "89 Kc", allergens: "1,3,7" },
  { id: "dessert-medovnik", category: "Dezert", name: "Medovnik", price: "89 Kc", allergens: "1,3,7,8" },
] as const;
