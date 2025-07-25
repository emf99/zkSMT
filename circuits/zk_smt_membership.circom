pragma circom 2.0.0;

// Uproszczony circuit do dowodzenia znajomości wartości w SMT
// bez ujawniania tej wartości - używa prostego hashowania
template ZKSMTMembership() {
    // Publiczne wejścia
    signal input publicKey;      // Publiczny klucz (np. hash("bob"))
    signal input expectedRoot;   // Oczekiwany root SMT
    
    // Prywatne wejścia (świadek - witness)
    signal private input secretValue;    // Sekretna wartość (ID użytkownika)
    signal private input salt;           // Dodatkowy salt dla bezpieczeństwa
    signal private input sibling1;       // Pierwszy sibling w ścieżce Merkle
    signal private input sibling2;       // Drugi sibling w ścieżce Merkle
    signal private input sibling3;       // Trzeci sibling w ścieżce Merkle
    
    // Wyjście
    signal output valid;
    
    // Oblicz hash liścia = publicKey * secretValue + salt (prosty hash)
    signal leafHash;
    leafHash <== publicKey * secretValue + salt;
    
    // Symulujemy ścieżkę w drzewie Merkle (uproszczona wersja)
    // Poziom 1: leafHash + sibling1
    signal level1;
    level1 <== leafHash + sibling1;
    
    // Poziom 2: level1 + sibling2  
    signal level2;
    level2 <== level1 + sibling2;
    
    // Poziom 3 (root): level2 + sibling3
    signal computedRoot;
    computedRoot <== level2 + sibling3;
    
    // Sprawdź czy obliczony root jest równy oczekiwanemu
    // Używamy prostego równania ograniczenia
    computedRoot === expectedRoot;
    
    // Wyjście zawsze 1 jeśli constraints są spełnione
    valid <== 1;
}

component main = ZKSMTMembership();
