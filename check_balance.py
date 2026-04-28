import sys

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    p_stack = [] # Parentheses
    b_stack = [] # Braces
    
    line = 1
    col = 1
    for i, char in enumerate(content):
        if char == '\n':
            line += 1
            col = 1
            continue
        
        if char == '(':
            p_stack.append(('(', line, col))
        elif char == ')':
            if not p_stack:
                print(f"Extra closing parenthesis at line {line}, col {col}")
            else:
                p_stack.pop()
        
        if char == '{':
            b_stack.append(('{', line, col))
        elif char == '}':
            if not b_stack:
                print(f"Extra closing brace at line {line}, col {col}")
            else:
                b_stack.pop()
        
        col += 1
    
    if p_stack:
        for char, l, c in p_stack:
            print(f"Unclosed {char} starting at line {l}, col {c}")
    if b_stack:
        for char, l, c in b_stack:
            print(f"Unclosed {char} starting at line {l}, col {c}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
