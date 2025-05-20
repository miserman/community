#' Create a new package function
#'
#' Create initial script and test files for a function that is to be added to a package.
#'
#' @param name Name of the function. Should start with the function's category, followed by a specific name,
#' separated by an underscore (\code{'_'}) (e.g., \code{'init_function'}).
#' @param dir Path to the package's development directory; default is the current working directory.
#' @param overwrite Logical; if \code{TRUE}, replaces existing files with templates.
#' @examples
#' \dontrun{
#'
#' # creates a skeleton for a `measure_new` function
#' init_function("measure_new")
#' }
#' @return Creates files in \code{dir/R} and \code{dir/tests/testthat}, attempts to navigate to the code file,
#' and returns a character vector to their paths.
#' @export

init_function <- function(name, dir = ".", overwrite = FALSE) {
  if (missing(name)) cli_abort("{.arg name} must be specified")
  name <- sub("\\.[Rr]$", "", name[[1]])
  dir <- paste0(normalizePath(dir, "/"), "/")
  if (!check_template("package", dir = dir)$exists) {
    cli_abort(paste(
      "{.arg dir} must be a package directory,",
      "but {.code check_template('package')} failed"
    ))
  }
  paths <- paste0(dir, c("R/", "tests/testthat/test-"), name, ".R")
  if (!overwrite && any(file.exists(paths)))
    cli_abort("files exist -- set overwrite to {.code TRUE} to overwrite them")
  if (!grepl("_", name, fixed = TRUE))
    cli_abort("name should be in a {.emph prefix_suffix} format")
  writeLines(
    paste0(
      "#' <template: Short, high-level description of function.>",
      "\n#'\n#' <template: Full description of function.>\n#'",
      "\n#' @param argument <template: Argument description.>",
      "\n#' @examples\n#' \\dontrun{",
      "\n#' <template: a working example for illustration; add outside of \\dontrun{} when possible>\n#' }",
      "\n#' @return <template: Description of what is returned.>",
      "\n#' @export",
      "\n\n",
      name,
      " <- function(argument){\n\n}"
    ),
    paths[1]
  )
  writeLines(
    paste0(
      "test_that('a test has been written for ",
      name,
      "', {\n  expect_true(FALSE)\n})"
    ),
    paths[2]
  )
  msg <- c("created files for function {name}:", paste0("{.file ", paths, "}"))
  names(msg) <- c("v", rep("*", length(paths)))
  if (interactive()) {
    cli_bullets(msg)
    navigateToFile(paths[1])
  }
  invisible(paths)
}
