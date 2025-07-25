// Najprostszy możliwy ZK circuit dla SMT
template BasicSMT() {
    // Publiczne
    signal input root;
    signal input key;
    
    // Prywatne (witness)
    signal private input value;
    signal private input nonce;
    
    // Bardzo proste ograniczenie: hash(key, value, nonce) == root
    // gdzie hash to po prostu suma kwadratów
    signal keySquared;
    signal valueSquared;
    signal nonceSquared;
    
    keySquared <== key * key;
    valueSquared <== value * value;  
    nonceSquared <== nonce * nonce;
    
    // Root musi być sumą kwadratów
    root === keySquared + valueSquared + nonceSquared;
}

component main = BasicSMT();
