// ZK Circuit do dowodzenia membership w SMT bez ujawniania wartości
template ZKSMTMembership() {
    // Publiczne wejścia  
    signal input publicKey;      // Publiczny klucz (np. hash nazwy użytkownika)
    signal input expectedRoot;   // Oczekiwany root SMT
    
    // Prywatne wejścia (witness) - te wartości nie są ujawniane
    signal private input secretValue;    // Sekretna wartość (ID użytkownika) 
    signal private input salt;           // Salt dla bezpieczeństwa
    signal private input sibling1;       // Pierwszy sibling w ścieżce Merkle
    signal private input sibling2;       // Drugi sibling w ścieżce Merkle
    signal private input sibling3;       // Trzeci sibling w ścieżce Merkle
    
    // Oblicz hash liścia jako funkcję publicKey, secretValue i salt
    signal leafHash;
    signal keyValueProduct;
    signal saltSquared;
    
    keyValueProduct <== publicKey * secretValue;
    saltSquared <== salt * salt;
    leafHash <== keyValueProduct + saltSquared;
    
    // Symuluj ścieżkę w drzewie Merkle (3 poziomy)
    signal level1Hash;
    signal level2Hash; 
    signal computedRoot;
    
    // Poziom 1: leafHash + sibling1
    level1Hash <== leafHash + sibling1;
    
    // Poziom 2: level1Hash + sibling2
    level2Hash <== level1Hash + sibling2;
    
    // Poziom 3 (root): level2Hash + sibling3  
    computedRoot <== level2Hash + sibling3;
    
    // Główne ograniczenie: obliczony root musi być równy oczekiwanemu
    expectedRoot === computedRoot;
}

component main = ZKSMTMembership();
