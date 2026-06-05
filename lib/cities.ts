export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  'South Africa': [
    'Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth',
    'Bloemfontein', 'East London', 'Nelspruit', 'Polokwane', 'Kimberley',
    'Pietermaritzburg', 'Rustenburg', 'George', 'Witbank', 'Vanderbijlpark',
    'Soweto', 'Benoni', 'Tembisa', 'Sandton', 'Randburg', 'Roodepoort',
    'Boksburg', 'Midrand', 'Centurion', 'Germiston', 'Springs', 'Krugersdorp',
    'Vereeniging', 'Stellenbosch', 'Paarl', 'Somerset West', 'Hermanus',
    'Knysna', 'Mossel Bay', 'Jeffreys Bay', 'Upington', 'Richards Bay',
    'Umhlanga', 'Ballito', 'Westville',
  ],
  'Zimbabwe': [
    'Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Kwekwe', 'Kadoma',
    'Masvingo', 'Chinhoyi', 'Marondera', 'Norton',
  ],
  'Botswana': [
    'Gaborone', 'Francistown', 'Maun', 'Molepolole', 'Serowe', 'Kanye', 'Selebi-Phikwe',
  ],
  'Namibia': [
    'Windhoek', 'Swakopmund', 'Walvis Bay', 'Oshakati', 'Rundu', 'Katima Mulilo',
  ],
  'Mozambique': [
    'Maputo', 'Matola', 'Beira', 'Nampula', 'Quelimane', 'Tete', 'Pemba',
  ],
  'Zambia': [
    'Lusaka', 'Kitwe', 'Ndola', 'Kabwe', 'Livingstone', 'Chipata',
  ],
  'Kenya': [
    'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi',
  ],
  'Nigeria': [
    'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Enugu', 'Benin City',
    'Kaduna', 'Ilorin', 'Aba', 'Warri', 'Onitsha',
  ],
  'Ghana': [
    'Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast', 'Koforidua',
  ],
  'United Kingdom': [
    'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool',
    'Edinburgh', 'Bristol', 'Sheffield', 'Newcastle', 'Nottingham', 'Cardiff',
    'Belfast', 'Leicester', 'Coventry', 'Bradford', 'Southampton', 'Brighton',
  ],
  'United States': [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
    'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
    'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco',
    'Seattle', 'Denver', 'Washington DC', 'Nashville', 'Oklahoma City',
    'Las Vegas', 'Miami', 'Atlanta', 'Boston', 'Portland', 'Detroit', 'Memphis',
  ],
  'Australia': [
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast',
    'Newcastle', 'Canberra', 'Sunshine Coast', 'Wollongong', 'Geelong',
    'Hobart', 'Townsville', 'Cairns', 'Darwin',
  ],
  'Canada': [
    'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa',
    'Winnipeg', 'Quebec City', 'Hamilton', 'Kitchener', 'London', 'Halifax',
  ],
  'Germany': [
    'Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart',
    'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden',
  ],
  'Netherlands': [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg',
    'Groningen', 'Almere', 'Breda', 'Nijmegen',
  ],
  'France': [
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg',
    'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims',
  ],
  'Spain': [
    'Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga',
    'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Córdoba',
  ],
  'Italy': [
    'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna',
    'Florence', 'Bari', 'Catania', 'Venice', 'Verona',
  ],
  'Portugal': [
    'Lisbon', 'Porto', 'Braga', 'Amadora', 'Funchal', 'Coimbra', 'Setúbal',
  ],
  'United Arab Emirates': [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah',
  ],
  'Other': [],
}

export const COUNTRIES = Object.keys(CITIES_BY_COUNTRY).sort()
