pragma circom 2.0.0;

// Uproszczony circuit do dowodzenia członkostwa w SMT
// Używa prostego hash'owania zamiast SHA256 dla demonstracji
template SimpleSMTMembership() {
    // Publiczne wejścia
    signal input root;               // Root drzewa SMT
    signal input key;                // Klucz (dla uproszczenia liczba)
    
    // Prywatne wejścia (witness)
    signal private input value;      // Wartość dla klucza (sekretna)
    signal private input sibling1;   // Pierwszy element proof'a
    signal private input sibling2;   // Drugi element proof'a
    signal private input sibling3;   // Trzeci element proof'a
    
    // Komponenty pomocnicze
    signal key_squared;
    signal value_squared;
    signal leaf_hash;
    signal intermediate_hash1;
    signal intermediate_hash2;
    signal computed_root;
    
    // Krok 1: Oblicz hash liścia = key² + value²
    key_squared <== key * key;
    value_squared <== value * value;
    leaf_hash <== key_squared + value_squared;
    
    // Krok 2: Oblicz ścieżkę przez drzewo
    // Hash poziomu 1: leaf_hash + sibling1
    intermediate_hash1 <== leaf_hash + sibling1;
    
    // Hash poziomu 2: intermediate_hash1 + sibling2  
    intermediate_hash2 <== intermediate_hash1 + sibling2;
    
    // Hash root: intermediate_hash2 + sibling3
    computed_root <== intermediate_hash2 + sibling3;
    
    // Sprawdzenie: obliczony root musi równać się podanemu root
    root === computed_root;
}

component main = SimpleSMTMembership();
