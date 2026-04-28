
import sys
with open(r'c:\Users\axelm\OneDrive\Desktop\Weep\src\pages\PruebasWalletApp.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
# lines are 0-indexed. line 1401 in view_file is index 1400.
# we want to delete from line 1401 to 1438 (indices 1400 to 1437)
new_lines = lines[:1400] + lines[1438:]
with open(r'c:\Users\axelm\OneDrive\Desktop\Weep\src\pages\PruebasWalletApp.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
