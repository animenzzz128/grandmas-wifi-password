# Sources

Gathered 2026-11-12 by web research. Principles in this skill are paraphrased. Items marked *(unverified)* came from secondary sources or summaries.

## LLM characters in games
- 1001 Nights (AIIDE 2023): https://arxiv.org/html/2308.12915v2
- Yonder, "What happened to the AI game?": https://blog.yonder.gg/p/what-happened-to-the-ai-game
- Jam & Tea, "Making Retail Mage": https://www.jamandtea.studio/news/making-retail-mage-a-new-approach-to-ai-in-games
- Jam & Tea on improvisation and generative AI: https://gamedeveloper.com/design/bringing-improvisation-to-digital-games-with-genai
- Ian Bicking, design review of Hidden Door: https://ianbicking.org/blog/2025/08/hidden-door-design-review-llm-driven-game
- Vaudeville pre-mortem: https://www.gamedeveloper.com/press-release/vaudeville-a-pre-mortem
- Vaudeville review (Game8): https://game8.co/articles/reviews/vaudeville-review
- Event[0] Q&A: https://gamedeveloper.com/design/q-a-ocelot-society-on-building-i-event-0-i-around-an-ai-chatbot
- Event[0] narrative chatbot: https://gamedeveloper.com/design/making-a-chatbot-that-drives-a-narrative-in-sci-fi-exploration-game-i-event-0-i-
- Ubisoft NEO NPC: https://news.ubisoft.com/en-us/article/5qXdxhshJBXoanFZApdG3L
- AI NPC demos critique (Aftermath): https://aftermath.site/ai-npcs-nvidia-unity-ubisoft-convai-inworld
- Suck Up! (Keith Schacht): https://keithschacht.com/2024/Nov/26/vampire-game-based-around-ai-voice-suck-up/
- Façade lessons (Grand Text Auto): https://grandtextauto.soe.ucsc.edu/2008/03/18/ep-86-learning-from-facade/
- "Symbolically Scaffolded Play": https://arxiv.org/html/2510.25820v1
- Open-ended NPC dialogue pilot: https://delorenzo.inginf.units.it/fast-track/open-ended-npc-dialogue-favors-casual-players/
- LLM agents as difficulty testers: https://arxiv.org/html/2410.02829v1
- Vendor postmortem, "infinite freedom nearly killed the fun" *(vendor figures)*: https://dev.to/ashutosh-veriprajna/i-helped-build-ai-that-talks-back-in-video-games-infinite-freedom-nearly-killed-the-fun-5fa4
- Covert Protocol latency (TweakTown): https://www.tweaktown.com/news/98745/we-spoke-to-nvidias-digital-humans-in-the-covert-protocol-game-demo/index.html
- LLM-voiced NPCs *(blog)*: https://abratabia.com/ai-talking-characters/llm-voiced-npcs.php

## Secrets, safety, latency (Anthropic and others)
- Secret leakage from LLM NPCs: https://arxiv.org/html/2508.19288v1
- Lakera, "Who is Gandalf": https://lakera.ai/blog/who-is-gandalf
- Anthropic, mitigate jailbreaks: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks
- Anthropic, keep Claude in character: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/keep-claude-in-character
- Anthropic, reduce latency: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency
- Anthropic, prompt caching: https://platform.claude.com/en/docs/build-with-claude/prompt-caching
- Steam AI disclosure (press summaries; check Steamworks): https://www.gamingonlinux.com/2024/01/valve-announces-new-rules-for-games-with-ai-content-on-steam/ , https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/

## Deduction and puzzle design
- Golden Idol, puzzle design: https://www.gamedeveloper.com/design/case-of-the-golden-idol
- Golden Idol, testing and Thought Path: https://www.gamedeveloper.com/road-to-igf-2023/-the-case-of-the-golden-idol-i-used-frequent-testing-to-improve-its-mystery-solving
- Three pillars of investigative gameplay: https://filmstories.co.uk/features/the-three-pillars-of-investigative-gameplay/
- The Alexandrian, Three Clue Rule: https://thealexandrian.net/wordpress/1118/roleplaying-games/three-clue-rule
- GMTK, designing mysterious games: https://gmtk.substack.com/p/the-secret-to-designing-mysterious
- Outer Wilds learning design: https://rigdern.github.io/a/learning-about-learning/learning-design-insights-from-outer-wilds/
- Outer Wilds critical analysis: https://gamedeveloper.com/design/outer-wilds-critical-analysis
- Room Escape Artist, red herrings: https://roomescapeartist.com/2019/02/10/red-herrings/
- Return of the Obra Dinn *(confirmation rationale via Wikipedia)*: https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn
- Shadows of Doubt demo impressions: https://www.destructoid.com/shadows-of-doubt-steam-next-fest-demo-impressions-pc/
- Harvey Smith on environmental storytelling *(press coverage)*: https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/

## Feel, UI, accessibility
- MDN Pointer Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- Game Accessibility Guidelines: https://gameaccessibilityguidelines.com/full-list/
- Game Feel review (Liz England) *(secondary)*: https://lizengland.com/blog/review-game-feel-by-steve-swink/
- Vlambeer screenshake coverage *(partial)*: https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games
- Onboarding: https://gdevelop.io/blog/improve-game-tutorials , https://create.roblox.com/docs/production/game-design/onboarding-techniques

## Agent skills we borrowed structure from (ideas only, no text copied)
- threejs-game-skills (router, progress file, evidence scorecard), MIT: https://github.com/majidmanzarpour/threejs-game-skills
- Threejs-Awesome-Graphics-Agent-Skills (ordered build, visual validation), MIT: https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills
- Unity skills, craft-game-floors (quality floors; score-only reviews make no edits), Unity Companion License: https://github.com/Unity-Technologies/skills
- AlterLab GameForge (design review severity; "not for X" descriptions), MIT: https://github.com/AlterLab-IEU/AlterLab_GameForge
- claude-game-playtest-skills (verify input events, JSON output), MIT: https://github.com/jrejaud/claude-game-playtest-skills
- Anthropic skill best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices · Claude Code skills: https://code.claude.com/docs/en/skills
