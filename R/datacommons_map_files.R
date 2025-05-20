#' Map Data Commons Files
#'
#' Extract variables and IDs from files in datacommons repositories
#'
#' @param dir Directory of the data commons projects.
#' @param search_pattern A regular expression string used be passed to \code{\link{list.files}}.
#' @param variable_location The name of a column contain variable names in each dataset, or a function to retrieve
#' variable names (e.g., \code{colnames}).
#' @param id_location The name of a column contain IDs in each dataset, or a function to retrieve
#' IDs (e.g., \code{rownames}).
#' @param reader A function capable of handling a connection in its first argument, which returns a matrix-like object.
#' @param overwrite Logical; if \code{TRUE}, creates a new map even if one exists.
#' @param verbose Logical; if \code{FALSE}, does not print status messages.
#' @examples
#' \dontrun{
#' # from a data commons project directory
#' map <- datacommons_map_files(".")
#' }
#' @return An invisible \code{list}, including a \code{data.frame} of the mapped variables, with \code{variable} (variable name),
#' \code{repo} (the repository containing the file), \code{dir_name} (variable name with a prefix from the parent directories),
#' \code{full_name} (variable name with a prefix from the last part of the file's name, after a year or year range),
#' and \code{file} (path to the file) columns, and a \code{list} of the mapped IDs, with an entry for each ID,
#' each of which with entries for \code{repos} (repositories in which the ID appears) and \code{files} (files in which the ID appears).
#' @export

datacommons_map_files <- function(
  dir,
  search_pattern = "\\.csv(?:\\.[gbx]z2?)?$",
  variable_location = "measure",
  id_location = "geoid",
  reader = read.csv,
  overwrite = FALSE,
  verbose = TRUE
) {
  if (missing(dir)) cli_abort("{.arg dir} must be specified")
  dir <- paste0(normalizePath(dir, "/", FALSE), "/")
  check <- check_template("datacommons", dir = dir)
  if (!check$exists) {
    cli_abort(c(
      x = "{.arg dir} does not appear to point to a data commons project",
      i = paste0('initialize it with {.code init_datacommons("', dir, '")}')
    ))
  }
  if (!dir.exists(paste0(dir, "repos"))) {
    cli_abort(c(
      x = "no {.path repos} directory found in {.arg dir}",
      i = paste0(
        'use {.code datacommons_refresh("',
        dir,
        '")} to bring in remote data'
      )
    ))
  }
  commons <- jsonlite::read_json(paste0(dir, "commons.json"))
  all_files <- list.files(
    paste0(dir, c("cache", "repos")),
    search_pattern,
    full.names = TRUE,
    recursive = TRUE
  )
  all_files <- sort(all_files[
    !grepl("[/\\](?:code|docs|working|original)[/\\]|variable_map", all_files)
  ])
  if (!length(all_files)) cli_abort("no files were found")
  res <- paste0(dir, "cache/", c("variable_map.csv", "id_map.rds"))
  if (overwrite) unlink(res)
  if (
    all(file.exists(res)) && all(file.mtime(res) > max(file.mtime(all_files)))
  ) {
    if (verbose) cli_alert_success("the maps are up to date")
    return(invisible(list(variables = read.csv(res[1]), ids = readRDS(res[2]))))
  }
  i <- 1
  map <- idmap <- list()
  noread <- novars <- noids <- empty <- NULL
  repos <- sort(unlist(commons$repositories))
  manifest <- measure_info <- list()
  if (verbose) {
    cli_progress_step(
      "scanning files in repos: {i}/{length(repos)}",
      msg_done = "created file maps: {.file {res}}",
      spinner = TRUE
    )
  }
  for (i in seq_along(repos)) {
    r <- repos[[i]]
    manifest[[r]] <- list()
    files <- sort(list.files(
      paste0(dir, c("repos", "cache"), "/", sub("^[^/]+/", "", r)),
      search_pattern,
      full.names = TRUE,
      recursive = TRUE,
      ignore.case = TRUE
    ))
    measure_info_files <- sort(list.files(
      paste0(dir, "repos/", sub("^.+/", "", r)),
      "^measure_info[^.]*\\.json$",
      full.names = TRUE,
      recursive = TRUE
    ))
    measure_info_files <- measure_info_files[
      !duplicated(gsub("_rendered|/code/|/data/", "", measure_info_files))
    ]
    if (length(measure_info_files)) {
      measure_info <- c(
        measure_info,
        lapply(
          structure(
            measure_info_files,
            names = sub(
              paste0(dir, "repos/"),
              paste0(sub("/.*$", "", r), "/"),
              measure_info_files,
              fixed = TRUE
            )
          ),
          function(f) {
            tryCatch(
              data_measure_info(
                f,
                render = TRUE,
                write = FALSE,
                verbose = FALSE,
                open_after = FALSE,
                include_empty = FALSE
              ),
              error = function(e) {
                cli_alert_warning("failed to read measure info: {.file {f}}")
                NULL
              }
            )
          }
        )
      )
    }
    files <- files[files %in% all_files]
    for (f in files) {
      d <- attempt_read(f, id_location)
      if (!is.null(d)) {
        if (nrow(d)) {
          lcols <- tolower(colnames(d))
          vars <- c(id_location, variable_location)
          if (any(!vars %in% colnames(d))) {
            l <- !colnames(d) %in% vars & lcols %in% vars
            colnames(d)[l] <- lcols[l]
          }
          if (
            is.character(variable_location) &&
              !variable_location %in% colnames(d)
          ) {
            novars <- c(novars, f)
            next
          }
          if (is.character(id_location) && !id_location %in% colnames(d)) {
            noids <- c(noids, f)
            next
          }
          hash <- md5sum(f)[[1]]
          relf <- sub(
            paste0(dir, "repos/", sub("^.+/", "", r), "/"),
            "",
            f,
            fixed = TRUE
          )
          manifest[[r]][[hash]]$name <- relf
          manifest[[r]][[hash]]$providers <- c(
            manifest[[r]][[hash]]$provider,
            if (grepl("repos/", f, fixed = TRUE)) "github" else "dataverse"
          )
          vars <- if (is.function(variable_location)) variable_location(d) else
            d[[variable_location]]
          if (length(vars)) {
            vars <- unique(vars[!is.na(vars)])
            map[[f]] <- data.frame(
              variable = vars,
              dir_name = paste0(
                gsub(
                  paste0(dir, "|cache/|repos/|data/|distribution/"),
                  "",
                  paste0(dirname(f), "/")
                ),
                vars
              ),
              full_name = make_full_name(f, vars),
              repo = r,
              file = sub(dir, "", f, fixed = TRUE)
            )
            manifest[[r]][[hash]]$variables <- vars
          } else {
            novars <- c(novars, f)
          }
          ids <- if (is.function(id_location)) id_location(d) else
            d[[id_location]]
          if (length(ids)) {
            ids <- gsub(
              "^\\s+|\\s+$",
              "",
              format(unique(ids), scientific = FALSE)
            )
            idmap[[f]] <- data.frame(id = ids, repo = r, file = relf)
            manifest[[r]][[hash]]$ids <- ids
          } else {
            noids <- c(noids, f)
          }
        } else {
          empty <- c(empty, f)
        }
      } else {
        noread <- c(noread, f)
      }
    }
    if (verbose) cli_progress_update()
  }
  if (verbose) cli_progress_done()
  if (length(measure_info)) {
    jsonlite::write_json(
      measure_info,
      paste0(dir, "cache/measure_info.json"),
      auto_unbox = TRUE
    )
  }
  map <- do.call(rbind, unname(map))
  idmap <- do.call(rbind, unname(idmap))
  if (verbose) {
    if (length(noread)) cli_warn("file{?s} could not be read in: {noread}")
    if (length(empty)) cli_warn("{?files have/file had} no rows: {empty}")
    if (length(novars))
      cli_warn(
        "{.arg {variable_location}} was not in {?some files'/a file's} column names: {novars}"
      )
    if (length(noids))
      cli_warn(
        "{.arg {id_location}} was not in {?some files'/a file's} column names: {noids}"
      )
  }
  if (!length(idmap)) cli_abort("no IDs were mapped")
  dir.create(paste0(dir, "manifest"), FALSE)
  jsonlite::write_json(
    manifest,
    paste0(dir, "manifest/files.json"),
    auto_unbox = TRUE,
    pretty = TRUE
  )
  dir.create(paste0(dir, "cache"), FALSE)
  idmap <- lapply(
    split(idmap, idmap$id),
    function(d) list(repos = unique(d$repo), files = unique(d$file))
  )
  saveRDS(idmap, res[2], compress = "xz")
  write.csv(map, res[1], row.names = FALSE)
  init_datacommons(dir, refresh_after = FALSE, verbose = FALSE)
  invisible(list(variables = map, ids = idmap))
}
