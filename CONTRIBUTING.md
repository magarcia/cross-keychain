<!-- omit in toc -->

# Contributing to cross-keychain

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions. 🎉

> And if you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation, which we would also be very happy about:
>
> - Star the project
> - Tweet about it
> - Refer this project in your project's readme
> - Mention the project at local meetups and tell your friends/colleagues

<!-- omit in toc -->

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Your First Code Contribution](#your-first-code-contribution)
- [Improving The Documentation](#improving-the-documentation)
- [Styleguides](#styleguides)
- [Commit Messages](#commit-messages)
- [Join The Project Team](#join-the-project-team)

## Code of Conduct

This project and everyone participating in it is governed by the
[cross-keychain Code of Conduct](https://github.com/magarcia/cross-keychain/blob/main/CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable behavior
to contact@magarcia.io.

## I Have a Question

> If you want to ask a question, we assume that you have read the available [Documentation](https://github.com/magarcia/cross-keychain).

Before you ask a question, it is best to search for existing [Issues](https://github.com/magarcia/cross-keychain/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](https://github.com/magarcia/cross-keychain/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

We will then take care of the issue as soon as possible.

<!--
You might want to create a separate issue tag for questions and include it in this description. People should then tag their issues accordingly.

Depending on how large the project is, you may want to outsource the questioning, e.g. to Stack Overflow or Gitter. You may add additional contact and information possibilities:
- IRC
- Slack
- Gitter
- Stack Overflow tag
- Blog
- FAQ
- Roadmap
- E-Mail List
- Forum
-->

## I Want To Contribute

> ### Legal Notice <!-- omit in toc -->
>
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content and that the content you contribute may be provided under the project licence.

### Reporting Bugs

<!-- omit in toc -->

#### Before Submitting a Bug Report

A good bug report shouldn't leave others needing to chase you up for more information. Therefore, we ask you to investigate carefully, collect information and describe the issue in detail in your report. Please complete the following steps in advance to help us fix any potential bug as fast as possible.

- Make sure that you are using the latest version.
- Determine if your bug is really a bug and not an error on your side e.g. using incompatible environment components/versions (Make sure that you have read the [documentation](https://github.com/magarcia/cross-keychain). If you are looking for support, you might want to check [this section](#i-have-a-question)).
- To see if other users have experienced (and potentially already solved) the same issue you are having, check if there is not already a bug report existing for your bug or error in the [bug tracker](https://github.com/magarcia/cross-keychain/issues?q=label%3Abug).
- Also make sure to search the internet (including Stack Overflow) to see if users outside of the GitHub community have discussed the issue.
- Collect information about the bug:
- Stack trace (Traceback)
- OS, Platform and Version (Windows, Linux, macOS, x86, ARM)
- Version of the interpreter, compiler, SDK, runtime environment, package manager, depending on what seems relevant.
- Possibly your input and the output
- Can you reliably reproduce the issue? And can you also reproduce it with older versions?

<!-- omit in toc -->

#### How Do I Submit a Good Bug Report?

> You must never report security related issues, vulnerabilities or bugs including sensitive information to the issue tracker, or elsewhere in public. Instead sensitive bugs must be sent by email to <contact@magarcia.io>.

<!-- You may add a PGP key to allow the messages to be sent encrypted as well. -->

We use GitHub issues to track bugs and errors. If you run into an issue with the project:

- Open an [Issue](https://github.com/magarcia/cross-keychain/issues/new). (Since we can't be sure at this point whether it is a bug or not, we ask you not to talk about a bug yet and not to label the issue.)
- Explain the behavior you would expect and the actual behavior.
- Please provide as much context as possible and describe the _reproduction steps_ that someone else can follow to recreate the issue on their own. This usually includes your code. For good bug reports you should isolate the problem and create a reduced test case.
- Provide the information you collected in the previous section.

Once it's filed:

- The project team will label the issue accordingly.
- A team member will try to reproduce the issue with your provided steps. If there are no reproduction steps or no obvious way to reproduce the issue, the team will ask you for those steps and mark the issue as `needs-repro`. Bugs with the `needs-repro` tag will not be addressed until they are reproduced.
- If the team is able to reproduce the issue, it will be marked `needs-fix`, as well as possibly other tags (such as `critical`), and the issue will be left to be [implemented by someone](#your-first-code-contribution).

<!-- You might want to create an issue template for bugs and errors that can be used as a guide and that defines the structure of the information to be included. If you do so, reference it here in the description. -->

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for cross-keychain, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

<!-- omit in toc -->

#### Before Submitting an Enhancement

- Make sure that you are using the latest version.
- Read the [documentation](https://github.com/magarcia/cross-keychain) carefully and find out if the functionality is already covered, maybe by an individual configuration.
- Perform a [search](https://github.com/magarcia/cross-keychain/issues) to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.
- Find out whether your idea fits with the scope and aims of the project. It's up to you to make a strong case to convince the project's developers of the merits of this feature. Keep in mind that we want features that will be useful to the majority of our users and not just a small subset. If you're just targeting a minority of users, consider writing an add-on/plugin library.

<!-- omit in toc -->

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](https://github.com/magarcia/cross-keychain/issues).

- Use a **clear and descriptive title** for the issue to identify the suggestion.
- Provide a **step-by-step description of the suggested enhancement** in as many details as possible.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why. At this point you can also tell which alternatives do not work for you.
- You may want to **include screenshots or screen recordings** which help you demonstrate the steps or point out the part which the suggestion is related to. You can use [LICEcap](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and the built-in [screen recorder in GNOME](https://help.gnome.org/users/gnome-help/stable/screen-shot-record.html.en) or [SimpleScreenRecorder](https://github.com/MaartenBaert/ssr) on Linux. <!-- this should only be included if the project has a GUI -->
- **Explain why this enhancement would be useful** to most cross-keychain users. You may also want to point out the other projects that solved it better and which could serve as inspiration.

<!-- You might want to create an issue template for enhancement suggestions that can be used as a guide and that defines the structure of the information to be included. If you do so, reference it here in the description. -->

### Your First Code Contribution

Ready to contribute? Here's how to set up your environment and get started.

**Prerequisites**

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

**Setup**

1.  Fork the repository on GitHub.
2.  Clone your fork locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/cross-keychain.git
    cd cross-keychain
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```

**Development**

This project uses TypeScript and can be built and tested with the following commands:

- To build the project:
  ```bash
  npm run build
  ```
- To run tests:
  ```bash
  npm run test
  ```
- To run type checking:
  ```bash
  npm run typecheck
  ```
- To run linting:
  ```bash
  npm run lint
  ```

**Making Changes**

1.  Create a new branch for your feature or bug fix:
    ```bash
    git checkout -b my-awesome-feature
    ```
2.  Make your changes.
3.  Make sure the code lints and builds correctly.
4.  Commit your changes. Please follow the [commit message guidelines](#commit-messages).
5.  Push your branch to your fork:
    ```bash
    git push origin my-awesome-feature
    ```
6.  Open a pull request to the `main` branch of the original repository.

### Improving The Documentation

Good documentation is crucial for a successful project. We appreciate any help in improving the documentation. You can help by:

- Reporting typos or grammatical errors.
- Suggesting improvements to the clarity of the documentation.
- Adding missing information.
- Translating the documentation into other languages.

To contribute to the documentation, you can follow the same process as for code contributions.

## Styleguides

### Commit Messages

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for all commit messages. This keeps history readable and enables automated changelogs and releases later on.

Structure:

```
<type>[optional scope]: <short description>

[optional body]

[optional footer(s)]
```

Allowed types:

- feat — a new feature
- fix — a bug fix
- docs — documentation only changes
- style — formatting, missing semi colons, etc; no code change
- refactor — code change that neither fixes a bug nor adds a feature
- perf — performance improvements
- test — adding or correcting tests
- build — changes that affect the build system or external dependencies
- ci — CI configuration or scripts
- chore — other changes that don't modify src or test files
- revert — revert a previous commit

Scopes (optional): prefer the folder or module you touched. Common scopes in this repo include: `cli`, `core`, `windows`, `macos`, `linux`, `tests`, `docs`, `ci`.

Breaking changes: indicate with either an exclamation mark after the type/scope (e.g., `feat!: ...`) or add a footer starting with `BREAKING CHANGE:` describing what changed and required actions.

Footers: use for metadata like issue references, e.g., `Closes #123`, `Refs #456`.

Examples:

```
feat(cli): add support for listing all stored credentials

fix(windows): handle missing credential manager service

refactor(core): simplify cross-keychain interface

perf(macos): batch keychain operations to reduce latency

docs: clarify API usage in README and examples

feat!: change CLI command structure

BREAKING CHANGE: CLI commands now use 'set/get/delete' instead of 'store/retrieve/remove'.
```

Tips:

- Keep the subject line under ~72 characters.
- Use the imperative mood ("add", "fix", "refactor").
- Align PR titles with Conventional Commits too—especially when using squash merges, as the PR title becomes the commit message.

## Join The Project Team

We are always looking for enthusiastic people to join our project team. If you are passionate about this project and have made significant contributions, we would be happy to welcome you to the team. To express your interest, please contact one of the existing team members.

<!-- omit in toc -->

## Attribution

This guide is based on the [contributing.md](https://contributing.md/generator)!
