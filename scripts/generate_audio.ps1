$texts = @{
    'welcome.wav' = 'Welcome to the Compiler Construction Learning Studio. I am your 3D teaching assistant. Click any button to explore.'
    'tokens.wav' = 'In this phase the Python tokenizer classifies the source into a token stream.'
    'tree.wav' = 'The parser constructs the Abstract Syntax Tree after checking Python syntax.'
    'compiler.wav' = 'Compiler Analysis presents token categories, the AST, symbol tables, and control flow.'
    'results.wav' = 'The 10-pass optimization lab applies constant folding, dead code elimination, and loop optimizations.'
    'analyze.wav' = 'Analyze processes the source code into lexical, syntax, semantic, and control-flow representations.'
    'optimize.wav' = 'Optimize applies all enabled optimization passes to eliminate dead code and fold constants.'
}

foreach ($name in $texts.Keys) {
    $out = "frontend\static\audio\$name"
    if (-not (Test-Path $out)) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tts.ps1 -text $texts[$name] -outWav $out
        Write-Host "Created $name"
    }
}
