pragma circom 2.0.0;

// Import SHA256 circuit (w prawdziwej implementacji)
include "circomlib/circuits/sha256/sha256.circom";
include "circomlib/circuits/comparators.circom";

// Circuit do dowodzenia członkostwa w Sparse Merkle Tree
template SMTMembership(levels) {
    // Publiczne wejścia
    signal input root;               // Root drzewa SMT
    signal input key_hash;           // Hash klucza (publiczny)
    
    // Prywatne wejścia (witness)
    signal private input value;      // Wartość dla klucza (sekretna)
    signal private input path_elements[levels];  // Elementy ścieżki Merkle
    signal private input path_indices[levels];   // Kierunki w drzewie (0=left, 1=right)
    
    // Oblicz hash wartości
    component value_hasher = Sha256(256);
    for (var i = 0; i < 32; i++) {
        for (var j = 0; j < 8; j++) {
            value_hasher.in[i*8 + j] <== (value >> (i*8 + j)) & 1;
        }
    }
    
    // Początkowy hash liścia = hash(key_hash, value_hash)
    component leaf_hasher = Sha256(512);
    
    // Wejście: key_hash (256 bitów)
    for (var i = 0; i < 32; i++) {
        for (var j = 0; j < 8; j++) {
            leaf_hasher.in[i*8 + j] <== (key_hash >> (i*8 + j)) & 1;
        }
    }
    
    // Wejście: value_hash (256 bitów)
    for (var i = 0; i < 32; i++) {
        for (var j = 0; j < 8; j++) {
            leaf_hasher.in[256 + i*8 + j] <== value_hasher.out[i*8 + j];
        }
    }
    
    // Oblicz ścieżkę przez drzewo
    component hashers[levels];
    component selectors[levels];
    
    signal current_hash[levels + 1];
    
    // Początkowy hash to hash liścia
    for (var i = 0; i < 256; i++) {
        current_hash[0] <== leaf_hasher.out[i];
    }
    
    // Dla każdego poziomu drzewa
    for (var i = 0; i < levels; i++) {
        // Selektor do wyboru czy current_hash idzie na lewo czy prawo
        selectors[i] = Mux1();
        selectors[i].c[0] <== path_elements[i];
        selectors[i].c[1] <== current_hash[i];
        selectors[i].s <== path_indices[i];
        
        // Hash dla tego poziomu
        hashers[i] = Sha256(512);
        
        // Lewe dziecko
        for (var j = 0; j < 256; j++) {
            hashers[i].in[j] <== selectors[i].out;
        }
        
        // Prawe dziecko  
        for (var j = 0; j < 256; j++) {
            hashers[i].in[256 + j] <== path_elements[i];
        }
        
        // Wynik to hash dla następnego poziomu
        for (var j = 0; j < 256; j++) {
            current_hash[i + 1] <== hashers[i].out[j];
        }
    }
    
    // Ostateczny hash musi równać się root
    for (var i = 0; i < 256; i++) {
        root === current_hash[levels];
    }
}

// Instancja dla drzewa o głębokości 8 (256 liści)
component main = SMTMembership(8);
