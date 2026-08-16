.PHONY: install build test quality clean example redteam link

install:
	pnpm install

build:
	pnpm run build

test:
	pnpm test

quality: build test

clean:
	rm -rf dist coverage .nyc_output

example:
	@echo "Example: search this repo's own history"
	node dist/cli.js . -p "initial" --limit 5

redteam: build
	bash scripts/red_team.sh

link: build
	pnpm link --global
