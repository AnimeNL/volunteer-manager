---
name: self-review
description: Explains how to self-review changes prior to considering a task complete.
---

# Skill Name: Self-review code changes

## Instructions & Core Logic
You must always self review your code before considering a task complete. In this project, the
following analysis must be performed:

* **Correctness**: Does the code achieve its stated purpose without bugs or logical errors?
* **Maintainability**: Is the code clean, well-structured, and easy to understand and modify in the
  future? Consider factors like code clarity, modularity, and adherence to established design
  patterns.
* **Readability**: Is the code well-commented (where necessary) and consistently formatted according
  to our project's coding style guidelines?
* **Efficiency**: Are there any obvious performance bottlenecks or resource inefficiencies
  introduced by the changes? Consider that this system generally is very low usage.
* **Security**: Are there any potential security vulnerabilities or insecure coding practices?
* **Edge Cases and Error Handling**: Does the code appropriately handle edge cases and potential
  errors?

You must prioritise readability and maintainability. Simple, readable code with a low degree of
complexity is strongly preferred. Duplication is frowned upon for this reason, but deduplication
leading to a lot of considtionals is frowned upon more. Suggest opportunities to the user.

You must match the coding and style conventions of the existing project. Some specific rules:

* Lines must not exceed 100 characters in length. Exceptions are import statements and URLs in
  comments. When wrapping lines, prefer the consistent and most readable approach.
* When it helps readability, occasionally a blank line is inserted before closing a block. This is
  particularly common in (but not exclusive to) React hooks, `withContext()` and `withRowModel()`.
* Prefer clear function, method and variable naming over comments.
* Match comment use of existing code, but suggest to the user when it seems superfluous.
