#' Create new template initializer
#'
#' Create a new initializer function, and a spec file against which initialized templates can be checked.
#'
#' @param name Name of the template to be checked.
#' @param files List of paths to required files, relative to dir.
#' \code{"{name}"} included in a path string will be replaced with \code{name} during checks.
#' A list within the main list is treated as either alternatives files (when there is a single character vector),
#' or alternative strict sets of files (must contain all of at least one list;
#' when there are multiple character vectors).
#' @param dir Package directory.
#' @param spec_dir Parent directory of the \code{files}.
#' @param context name of the template's context: itself, or another templated structure.
#' @param overwrite logical; if \code{TRUE}, new files will replace existing ones.
#' @examples
#' \dontrun{
#'
#' # creates a version of the function spec.
#' init_template("function", list("R/{name}.R", "tests/testthat/text-{name}.R"))
#'
#' # creates a version of the shiny function, showing alternative sets
#' init_template("shiny", list(
#'   list(
#'     c("ui.R", "server.R"),
#'     "app.R"
#'   ),
#'   "README.md"
#' ), spec_dir = "app")
#' }
#' @return Creates a name.json file (in \code{dir/inst/specs} if it exists, or the current working directory),
#' and invisibly returns its path.
#' @export

init_template <- function(
  name,
  files,
  dir = ".",
  spec_dir = ".",
  context = name,
  overwrite = FALSE
) {
  if (missing(name)) cli_abort("{.arg name} must be specified")
  if (missing(files)) cli_abort("{.arg files} must be specified")
  name <- sub("^init_", "", name)
  dir <- normalizePath(dir, "/", FALSE)
  spec <- list(
    name = name,
    context = context,
    dir = spec_dir,
    files = files
  )
  test_path <- paste0(dir, "/tests/testthat/test-init_", name, ".R")
  template_test <- file.exists(test_path)
  init_function(paste0("init_", name), dir = dir, overwrite = overwrite)
  if (overwrite || !template_test) {
    writeLines(
      paste0(
        "test_that(\"check_template passes\", {",
        "\n  dir <- tempdir(TRUE)",
        "\n  on.exit(unlink(dir, TRUE, TRUE))",
        if (spec$name != spec$context) {
          paste0(
            "\n  init_",
            spec$context,
            "(\"test_context\", dir = dir)\n  dir <- paste0(dir, \"/test_context\")"
          )
        },
        "\n  init_",
        name,
        "(\"test_",
        name,
        "\", dir = dir)",
        "\n  expect_true(check_template(\"",
        name,
        "\", \"test_",
        name,
        "\", dir = dir)$exists)",
        "\n})",
        sep = ""
      ),
      test_path
    )
  }
  path <- normalizePath(
    paste0(
      dir,
      if (file.exists(paste0(dir, "/inst"))) "/inst",
      "/specs/",
      name,
      ".json"
    ),
    "/",
    FALSE
  )
  if (overwrite || !file.exists(path))
    jsonlite::write_json(spec, path, auto_unbox = TRUE)
  if (interactive()) {
    cli_bullets(c(
      v = "created a spec file for {name}:",
      "*" = paste0("{.file ", path, "}")
    ))
  }
  invisible(path)
}
