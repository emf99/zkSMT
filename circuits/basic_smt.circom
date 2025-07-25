// Bardzo prosty ZK proof dla SMT membership
// Bez zewnętrznych dependencies

template Hash2() {
    signal input left;
    signal input right;
    signal output out;
    
    // Prosta funkcja hash: (left + right) * (left + right + 1) 
    signal sum;
    sum <== left + right;
    out <== sum * (sum + 1);
}

template SMTProof() {
    // Publiczne inputs
    signal input root;
    signal input key;
    
    // Prywatne inputs (witness - to jest sekret!)
    signal private input value;
    signal private input sibling;
    signal private input isLeft; // 0 lub 1
    
    // Hash liścia (key, value)
    component leafHash = Hash2();
    leafHash.left <== key;
    leafHash.right <== value;
    
    // Hash parent node
    component parentHash = Hash2();
    
    // Conditional assignment dla kolejności
    signal leftInput;
    signal rightInput;
    
    // Jeśli isLeft == 1: current jest left, sibling jest right
    // Jeśli isLeft == 0: sibling jest left, current jest right
    leftInput <== isLeft * leafHash.out + (1 - isLeft) * sibling;
    rightInput <== (1 - isLeft) * leafHash.out + isLeft * sibling;
    
    parentHash.left <== leftInput;
    parentHash.right <== rightInput;
    
    // Sprawdź czy parent hash == root
    root === parentHash.out;
    
    // Dodatkowe ograniczenie: isLeft może być tylko 0 lub 1
    isLeft * (isLeft - 1) === 0;
}

component main = SMTProof();
