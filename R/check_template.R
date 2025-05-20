#' Check the structure of a templated project
#'
#' Check if the parts of a template are in place, based on the template's spec.
#'
#' @param template Name of the template (e.g., \code{"function"}).
#' @param name Name of the template instance (e.g., \code{"test_function"}).
#' @param dir Path to the base directory of the template.
#' @param spec The template's spec; specify if template spec files do not exist.
#' @examples
#' \dontrun{
#' # precheck before a new template is made
#' check_template("template_new", list(name = "new", context = "new", files = list("new.R")))
#'
#' # check the new template after creation
#' check_template("new")
#' }
#' @return A list with results of the check:
#' \tabular{rl}{
#'   \strong{dir} \tab Path of the checked directory. \cr
#'   \strong{files} \tab Path(s) of the checked files. \cr
#'   \strong{spec} \tab A list with the template's spec. \cr
#'   \strong{status} \tab A named logical vector indicating whether each components exist. \cr
#'   \strong{incomplete} \tab A character vector with any existing files that still have template text. \cr
#'   \strong{exists} \tab \code{all(status)} \cr
#'   \strong{message} \tab A character vector including messages associated with failures. \cr
#' }
#' @export

check_template <- function(template, name = "", dir = ".", spec = NULL) {
  if (missing(template)) cli_abort("{.arg template} must be specified")
  template <- sub("^init_", "", template)
  report <- list(
    dir = dir,
    files = list(),
    spec = spec,
    status = c(spec = !is.null(spec), dir = FALSE, strict = TRUE, set = TRUE),
    incomplete = character(),
    exists = FALSE,
    message = character()
  )
  if (is.null(spec)) {
    path <- paste0(
      system.file(package = "community"),
      if (file.exists(paste0(system.file(package = "community"), "/inst")))
        "/inst",
      "/specs/",
      sub(".json", "", template, fixed = TRUE),
      ".json"
    )
    report$status["spec"] <- file.exists(path)
    if (!report$status["spec"]) {
      report$status[] <- FALSE
      return(report)
    }
    spec <- jsonlite::read_json(path)
  }
  report$spec <- spec
  if (missing(name)) {
    name <- spec$name
  }
  strict <- vapply(
    spec$files,
    function(f) is.character(f) && length(f) == 1,
    TRUE
  )
  dir <- paste0(normalizePath(paste0(dir, "/", spec$dir), "/", FALSE), "/")
  report$dir <- dir
  report$status["dir"] <- dir.exists(dir)
  if (spec$context != spec$name) {
    check_context <- check_template(spec$context, dir = dir)
    if (!check_context$exists)
      cli_abort(c(
        "context {spec$context} check failed for {name}:",
        check_context$message
      ))
  }
  if (!report$status["dir"]) {
    report$message <- c(
      x = paste0(
        "the required directory ({.path ",
        spec$dir,
        "}) is not present in {.path ",
        normalizePath(dir, "/", FALSE),
        "}"
      )
    )
  }
  if (any(strict)) {
    files <- gsub(
      "{name}",
      name,
      paste0(dir, unlist(spec$files[strict])),
      fixed = TRUE
    )
    report$files <- files
    present <- file.exists(files)
    report$status["strict"] <- all(present)
    if (!report$status["strict"]) {
      report$message <- c(
        report$message,
        x = paste0(
          "required file",
          if (sum(!present) == 1) " is" else "s are",
          " not present: ",
          paste0("{.path ", files[!present], "}", collapse = ", ")
        )
      )
    } else {
      for (f in files[present]) {
        if (
          !dir.exists(f) &&
            grepl(
              "<template:",
              paste(readLines(f, warn = FALSE), collapse = ""),
              fixed = TRUE
            )
        ) {
          report$incomplete <- c(report$incomplete, f)
        }
      }
    }
  }
  if (any(!strict)) {
    file_set <- spec$files[!strict][[1]]
    if (length(file_set) == 1) {
      files <- gsub(
        "{name}",
        spec$name,
        paste0(dir, file_set[[1]]),
        fixed = TRUE
      )
      report$files <- c(report$files, files)
      present <- file.exists(files)
      report$status["set"] <- any(present)
      if (!report$status["set"]) {
        report$message <- c(
          report$message,
          x = paste(
            "one of these files is required, but none were present:",
            paste(files, collapse = ", ")
          )
        )
      } else {
        for (f in files[present]) {
          if (
            !dir.exists(f) &&
              grepl(
                "<template:",
                paste(readLines(f, warn = FALSE), collapse = ""),
                fixed = TRUE
              )
          ) {
            report$incomplete <- c(report$incomplete, f)
          }
        }
      }
    } else {
      file_set <- lapply(
        file_set,
        function(fl) gsub("{name}", spec$name, paste0(dir, fl), fixed = TRUE)
      )
      report$files <- c(report$files, unlist(file_set))
      present <- vapply(file_set, function(fl) all(file.exists(fl)), TRUE)
      report$status["set"] <- any(present)
      if (!report$status["set"]) {
        report$message <- c(
          report$message,
          paste(
            x = "none of the required file sets were complete:",
            file_set
          )
        )
      } else {
        for (fl in file_set[present]) {
          for (f in fl) {
            if (
              !dir.exists(f) &&
                grepl(
                  "<template:",
                  paste(readLines(f, warn = FALSE), collapse = ""),
                  fixed = TRUE
                )
            ) {
              report$incomplete <- c(report$incomplete, f)
            }
          }
        }
      }
    }
  }
  if (report$status["dir"] && any(!report$status[c("strict", "set")])) {
    report$message <- c(
      report$message,
      i = "use {.fn template_{name}} to create required structure"
    )
  }
  if (all(report$status)) report$exists <- TRUE
  report
}
