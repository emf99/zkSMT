include "node_modules/circomlib/circuits/mimc.circom";

// Prosty template dla SMT membership proof
template SimpleSMT() {
    // Publiczne sygnały
    signal input root;
    signal input key;
    
    // Prywatne sygnały (witness)
    signal private input value;
    signal private input sibling;
    signal private input direction; // 0 lub 1
    
    // Hash liścia
    component leafHash = MiMC7(2);
    leafHash.x_in <== key;
    leafHash.k <== value;
    
    // Hash parent (w zależności od kierunku)
    component parentHash = MiMC7(2);
    
    // Jeśli direction == 0: hash(leaf, sibling)
    // Jeśli direction == 1: hash(sibling, leaf)
    signal left;
    signal right;
    
    left <== (1 - direction) * leafHash.out + direction * sibling;
    right <== direction * leafHash.out + (1 - direction) * sibling;
    
    parentHash.x_in <== left;
    parentHash.k <== right;
    
    // Sprawdź czy parent hash równa się root
    root === parentHash.out;
}

component main = SimpleSMT();
